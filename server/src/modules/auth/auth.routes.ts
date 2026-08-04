import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { Router } from 'express';
import { z } from 'zod';
import type { ServerEnvironment } from '../../config/env.js';
import { HttpError } from '../../lib/errors.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { requireUser } from '../../middleware/require-user.js';
import { type EmailGateway } from '../email/email.gateway.js';
import { AuthRepository, authProviderOf, type UserRecord } from './auth.repository.js';
import { createGoogleVerifier, type GoogleIdentity } from './google.js';
import { clearSession, issueSession } from './session.js';

const passwordSchema = z.string().min(12).max(128);
const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: passwordSchema,
});
const tokenSchema = z.object({ token: z.string().min(32).max(512) });
const googleCredentialSchema = z.object({ credential: z.string().min(64).max(4096) });

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
}

function credentialRateKey(request: Parameters<ReturnType<typeof rateLimit>>[0]): string {
  const email = typeof request.body?.email === 'string'
    ? normalizeEmail(request.body.email)
    : '';
  const identity = createHash('sha256').update(email || 'missing-email').digest('hex');
  return `${request.ip}:${identity}`;
}

function createToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString('base64url');
  return { raw, hash: createHash('sha256').update(raw).digest('hex') };
}

function publicUser(user: UserRecord) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    authProvider: authProviderOf(user),
    defaultRace: user.defaultRace,
    nickname: user.nickname,
    avatar: user.avatar,
  };
}

function body<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, 'INVALID_INPUT', 'Los datos enviados no son válidos.');
  return parsed.data;
}

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export interface AuthRouteDependencies {
  repository: AuthRepository;
  env: ServerEnvironment;
  email: EmailGateway;
}

export function createAuthRouter({ repository, env, email }: AuthRouteDependencies): Router {
  const router = Router();
  const authenticated = requireUser(repository, env);
  const googleVerifier = createGoogleVerifier(env);

  const verifyGoogleCredential = async (credential: string): Promise<GoogleIdentity> => {
    if (!googleVerifier) throw new HttpError(503, 'GOOGLE_DISABLED', 'El acceso con Google no está configurado en este servidor.');
    return googleVerifier(credential);
  };

  /**
   * Resuelve la cuenta por identificador de Google, luego por correo —lo que
   * vincula el acceso con Google a un registro previo— y sólo crea una cuenta
   * nueva si no existe ninguna.
   */
  const resolveGoogleUser = async (identity: GoogleIdentity): Promise<UserRecord> => {
    const linked = await repository.findByGoogleSub(identity.sub);
    const user = linked ?? await repository.findByEmail(identity.emailNormalized);
    if (!user) return repository.createGoogleUser(identity.email, identity.emailNormalized, identity.sub, identity.nickname);
    if (user.deletedAt || !user.isActive) throw new HttpError(403, 'ACCOUNT_UNAVAILABLE', 'Esa cuenta no está disponible. Contacta con el administrador.');
    if (user.googleSub && user.googleSub !== identity.sub) throw new HttpError(409, 'GOOGLE_ALREADY_LINKED', 'Ese correo ya está vinculado a otra cuenta de Google.');
    return user.googleSub ? user : repository.linkGoogleAccount(user.id, identity.sub);
  };

  /** Reautenticación: el token debe ser de la cuenta con la sesión abierta. */
  const requireGoogleReauthentication = async (user: UserRecord, credential: string): Promise<void> => {
    const identity = await verifyGoogleCredential(credential);
    if (!user.googleSub || user.googleSub !== identity.sub) throw new HttpError(401, 'INVALID_CREDENTIALS', 'La cuenta de Google no coincide con la sesión actual.');
  };
  const registrationByIp = rateLimit({ windowMs: 60 * 60 * 1000, max: 5 });
  const registrationByIdentity = rateLimit({ windowMs: 60 * 60 * 1000, max: 3, key: credentialRateKey });
  const loginByIp = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
  const loginByIdentity = rateLimit({ windowMs: 15 * 60 * 1000, max: 12, key: credentialRateKey });
  const emailByIp = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });
  const emailByIdentity = rateLimit({ windowMs: 15 * 60 * 1000, max: 3, key: credentialRateKey });

  router.post('/register', registrationByIp, registrationByIdentity, async (request, response) => {
    const { email: inputEmail, password } = body(credentialsSchema, request.body);
    const emailNormalized = normalizeEmail(inputEmail);
    const existing = await repository.findByEmail(emailNormalized);
    if (existing) throw new HttpError(409, 'EMAIL_UNAVAILABLE', 'No se pudo crear la cuenta con ese correo.');

    const user = await repository.createUser(inputEmail.trim(), emailNormalized, await hashPassword(password));
    const token = createToken();
    await repository.createToken(user.id, token.hash, 'VERIFY_EMAIL');
    let emailDeliveryWarning: string | null = null;
    try {
      await email.sendVerificationEmail(user.email, token.raw);
    } catch (error) {
      console.error('No se pudo enviar el correo de verificación inicial.', error);
      emailDeliveryWarning = 'La cuenta se creó, pero el correo no pudo enviarse todavía. Usa «Reenviar correo» dentro de unos minutos.';
    }
    response.status(emailDeliveryWarning ? 202 : 201).json({
      user: publicUser(user),
      verificationRequired: true,
      emailDeliveryWarning,
      developmentVerificationUrl: env.NODE_ENV === 'development'
        ? `${env.APP_BASE_URL}/verify-email?token=${token.raw}`
        : null,
    });
  });

  router.post('/login', loginByIp, loginByIdentity, async (request, response) => {
    const { email: inputEmail, password } = body(credentialsSchema, request.body);
    const user = await repository.findByEmail(normalizeEmail(inputEmail));
    // Una cuenta sólo de Google no tiene contraseña: se responde igual que ante
    // una contraseña incorrecta para no revelar cómo se registró nadie.
    const valid = user && !user.deletedAt && user.isActive && user.passwordHash && await argon2.verify(user.passwordHash, password);
    if (!valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
    issueSession(response, user.id, user.sessionVersion, env);
    await repository.recordLogin(user.id);
    response.json({ user: publicUser(user) });
  });

  router.post('/google', loginByIp, async (request, response) => {
    const { credential } = body(googleCredentialSchema, request.body);
    const identity = await verifyGoogleCredential(credential);
    const user = await resolveGoogleUser(identity);
    issueSession(response, user.id, user.sessionVersion, env);
    await repository.recordLogin(user.id);
    response.json({ user: publicUser(user) });
  });

  router.post('/logout', (_request, response) => {
    clearSession(response, env);
    response.status(204).end();
  });

  router.post('/refresh', authenticated, (request, response) => {
    const user = request.authenticatedUser!;
    issueSession(response, user.id, user.sessionVersion, env);
    response.status(204).end();
  });

  router.post('/verify-email', async (request, response) => {
    const { token } = body(tokenSchema, request.body);
    const user = await repository.consumeToken(createHash('sha256').update(token).digest('hex'), 'VERIFY_EMAIL');
    if (!user || user.deletedAt) throw new HttpError(400, 'INVALID_TOKEN', 'El enlace de verificación no es válido o ha caducado.');
    await repository.verifyEmail(user.id);
    response.status(204).end();
  });

  router.post('/request-verification', emailByIp, emailByIdentity, async (request, response) => {
    const { email: inputEmail } = body(z.object({ email: z.string().email().max(254) }), request.body);
    const user = await repository.findByEmail(normalizeEmail(inputEmail));
    if (user && !user.deletedAt && user.isActive && !user.emailVerifiedAt) {
      const token = createToken();
      await repository.createToken(user.id, token.hash, 'VERIFY_EMAIL');
      try {
        await email.sendVerificationEmail(user.email, token.raw);
      } catch (error) {
        console.error('No se pudo reenviar el correo de verificación.', error);
      }
    }
    response.status(204).end();
  });

  router.post('/request-password-reset', emailByIp, emailByIdentity, async (request, response) => {
    const { email: inputEmail } = body(z.object({ email: z.string().email().max(254) }), request.body);
    const user = await repository.findByEmail(normalizeEmail(inputEmail));
    if (user && !user.deletedAt && user.isActive) {
      const token = createToken();
      await repository.createToken(user.id, token.hash, 'RESET_PASSWORD');
      try {
        await email.sendPasswordResetEmail(user.email, token.raw);
      } catch (error) {
        // La respuesta se mantiene indistinguible para no revelar cuentas
        // existentes ni el estado del proveedor de correo.
        console.error('No se pudo enviar el correo de restablecimiento.', error);
      }
    }
    response.status(204).end();
  });

  router.post('/reset-password', async (request, response) => {
    const { token, password } = body(tokenSchema.extend({ password: passwordSchema }), request.body);
    const user = await repository.consumeToken(createHash('sha256').update(token).digest('hex'), 'RESET_PASSWORD');
    if (!user || user.deletedAt) throw new HttpError(400, 'INVALID_TOKEN', 'El enlace de restablecimiento no es válido o ha caducado.');
    await repository.updatePassword(user.id, await hashPassword(password));
    response.status(204).end();
  });

  router.get('/me', authenticated, (request, response) => {
    response.json({ user: publicUser(request.authenticatedUser!) });
  });

  router.put('/profile/default-race', authenticated, async (request, response) => {
    const { defaultRace } = body(z.object({ defaultRace: z.enum(['ZERG', 'TERRAN', 'PROTOSS']) }), request.body);
    const updated = await repository.updateDefaultRace(request.authenticatedUser!.id, defaultRace);
    response.json({ user: publicUser(updated) });
  });

  router.put('/profile', authenticated, async (request, response) => {
    const profile = body(z.object({
      defaultRace: z.enum(['ZERG', 'TERRAN', 'PROTOSS']),
      nickname: z.string().trim().min(2).max(32).nullable(),
      avatar: z.string().trim().min(1).max(16).nullable(),
    }), request.body);
    const updated = await repository.updateProfile(request.authenticatedUser!.id, profile);
    response.json({ user: publicUser(updated) });
  });

  router.post('/change-password', authenticated, async (request, response) => {
    const { currentPassword, newPassword } = body(
      z.object({ currentPassword: passwordSchema, newPassword: passwordSchema }),
      request.body,
    );
    const user = request.authenticatedUser!;
    if (!user.passwordHash) throw new HttpError(409, 'PASSWORD_NOT_SET', 'Esta cuenta todavía no tiene contraseña. Usa «Establecer contraseña».');
    if (!await argon2.verify(user.passwordHash, currentPassword)) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'La contraseña actual no es correcta.');
    }
    const updated = await repository.updatePassword(user.id, await hashPassword(newPassword));
    issueSession(response, updated.id, updated.sessionVersion, env);
    response.status(204).end();
  });

  // Primera contraseña de una cuenta de Google: como no hay contraseña anterior
  // que comprobar, la reautenticación la aporta el propio Google.
  router.post('/set-password', authenticated, async (request, response) => {
    const { credential, newPassword } = body(googleCredentialSchema.extend({ newPassword: passwordSchema }), request.body);
    const user = request.authenticatedUser!;
    if (user.passwordHash) throw new HttpError(409, 'PASSWORD_ALREADY_SET', 'Esta cuenta ya tiene contraseña. Usa «Cambiar contraseña».');
    await requireGoogleReauthentication(user, credential);
    const updated = await repository.updatePassword(user.id, await hashPassword(newPassword));
    issueSession(response, updated.id, updated.sessionVersion, env);
    response.json({ user: publicUser(updated) });
  });

  router.delete('/account', authenticated, async (request, response) => {
    const { password, credential } = body(
      z.object({ password: passwordSchema.optional(), credential: googleCredentialSchema.shape.credential.optional() }),
      request.body,
    );
    const user = request.authenticatedUser!;
    if (credential) await requireGoogleReauthentication(user, credential);
    else if (password && user.passwordHash) {
      if (!await argon2.verify(user.passwordHash, password)) throw new HttpError(401, 'INVALID_CREDENTIALS', 'La contraseña no es correcta.');
    } else throw new HttpError(401, 'REAUTHENTICATION_REQUIRED', 'Confirma tu identidad para borrar la cuenta.');
    await repository.softDeleteUser(user.id);
    clearSession(response, env);
    response.status(204).end();
  });

  return router;
}
