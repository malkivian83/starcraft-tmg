import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import argon2 from 'argon2';
import { Router } from 'express';
import { z } from 'zod';
import type { ServerEnvironment } from '../../config/env.js';
import { HttpError } from '../../lib/errors.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { requireUser } from '../../middleware/require-user.js';
import { type EmailGateway } from '../email/email.gateway.js';
import { AuthRepository, authProviderOf, type SupportedLocale, type UserRecord } from './auth.repository.js';
import { AVATAR_DATA_URL_PATTERN, AVATAR_STORED_PATH_PATTERN, AvatarStorage, decodeAvatarDataUrl } from './avatar-storage.js';
import { createGoogleVerifier, type GoogleIdentity } from './google.js';
import { clearSession, issueSession } from './session.js';

const passwordSchema = z.string().min(12).max(128);
const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: passwordSchema,
});
const tokenSchema = z.object({ token: z.string().min(32).max(512) });
const googleCredentialSchema = z.object({ credential: z.string().min(64).max(4096) });
const avatarSchema = z.string().trim().nullable().superRefine((value, context) => {
  if (value === null) return;
  if (value.length === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'El avatar no puede estar vacío.' });
    return;
  }

  // Se mantienen los avatares de emoji existentes. Las imágenes se aceptan
  // únicamente como data URL rasterizada para no permitir SVG ni HTML.
  if (AVATAR_STORED_PATH_PATTERN.test(value)) return;
  if (!value.startsWith('data:')) {
    if ([...value].length > 16) context.addIssue({ code: z.ZodIssueCode.custom, message: 'El avatar no es válido.' });
    return;
  }

  if (value.length > 220_000 || !AVATAR_DATA_URL_PATTERN.test(value) || !decodeAvatarDataUrl(value)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'La imagen del avatar no es válida.' });
    return;
  }

  const encoded = value.slice(value.indexOf(',') + 1);
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length > 150 * 1024) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'La imagen del avatar no puede superar 150 KB.' });
  }
});
const localeSchema = z.enum(['es', 'en']);
const TERMS_VERSION = '2026-08-05';

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
    locale: user.locale,
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
  avatarStorage: AvatarStorage;
}

export function createAuthRouter({ repository, env, email, avatarStorage }: AuthRouteDependencies): Router {
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
  const resolveGoogleUser = async (identity: GoogleIdentity, locale: SupportedLocale): Promise<UserRecord> => {
    const linked = await repository.findByGoogleSub(identity.sub);
    const user = linked ?? await repository.findByEmail(identity.emailNormalized);
    if (!user) return repository.createGoogleUser(identity.email, identity.emailNormalized, identity.sub, identity.nickname, locale);
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

  router.get('/avatars/:filename', async (request, response) => {
    const file = avatarStorage.resolvePublicFile(request.params.filename);
    if (!file) {
      response.sendStatus(404);
      return;
    }
    try {
      const contents = await readFile(file.path);
      response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      response.type(file.mime).send(contents);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') response.sendStatus(404);
      else throw error;
    }
  });

  router.post('/register', registrationByIp, registrationByIdentity, async (request, response) => {
    const { email: inputEmail, password, locale = 'es' } = body(credentialsSchema.extend({ locale: localeSchema.default('es'), termsAccepted: z.literal(true) }), request.body);
    const emailNormalized = normalizeEmail(inputEmail);
    const existing = await repository.findByEmail(emailNormalized);
    if (existing) throw new HttpError(409, 'EMAIL_UNAVAILABLE', 'No se pudo crear la cuenta con ese correo.');

    const user = await repository.createUser(inputEmail.trim(), emailNormalized, await hashPassword(password), locale);
    await repository.recordTermsAcceptance(user.id, TERMS_VERSION, locale, 'PASSWORD_REGISTRATION');
    const token = createToken();
    await repository.createToken(user.id, token.hash, 'VERIFY_EMAIL');
    let emailDeliveryWarning: string | null = null;
    try {
      await email.sendVerificationEmail(user.email, token.raw, user.locale);
    } catch (error) {
      console.error('No se pudo enviar el correo de verificación inicial.', error);
      emailDeliveryWarning = 'La cuenta se creó, pero el correo no pudo enviarse todavía. Usa «Reenviar correo» dentro de unos minutos.';
    }
    response.status(emailDeliveryWarning ? 202 : 201).json({
      user: publicUser(user),
      verificationRequired: true,
      emailDeliveryWarning,
      developmentVerificationUrl: env.NODE_ENV === 'development'
        ? `${env.APP_BASE_URL}/${locale}/${locale === 'en' ? 'verify-email' : 'verificar-correo'}?token=${token.raw}`
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
    const { credential, locale = 'es', termsAccepted = false } = body(googleCredentialSchema.extend({ locale: localeSchema.default('es'), termsAccepted: z.boolean().default(false) }), request.body);
    const identity = await verifyGoogleCredential(credential);
    const existing = await repository.findByGoogleSub(identity.sub) ?? await repository.findByEmail(identity.emailNormalized);
    if (!existing && !termsAccepted) throw new HttpError(428, 'TERMS_REQUIRED', 'Debes aceptar los términos y condiciones para crear una cuenta.');
    const user = await resolveGoogleUser(identity, locale);
    if (!existing) await repository.recordTermsAcceptance(user.id, TERMS_VERSION, locale, 'GOOGLE_REGISTRATION');
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
    const { email: inputEmail, locale } = body(z.object({ email: z.string().email().max(254), locale: localeSchema.default('es') }), request.body);
    const user = await repository.findByEmail(normalizeEmail(inputEmail));
    if (user && !user.deletedAt && user.isActive && !user.emailVerifiedAt) {
      const token = createToken();
      await repository.createToken(user.id, token.hash, 'VERIFY_EMAIL');
      try {
        await email.sendVerificationEmail(user.email, token.raw, user.locale ?? locale);
      } catch (error) {
        console.error('No se pudo reenviar el correo de verificación.', error);
      }
    }
    response.status(204).end();
  });

  router.post('/request-password-reset', emailByIp, emailByIdentity, async (request, response) => {
    const { email: inputEmail, locale } = body(z.object({ email: z.string().email().max(254), locale: localeSchema.default('es') }), request.body);
    const user = await repository.findByEmail(normalizeEmail(inputEmail));
    if (user && !user.deletedAt && user.isActive) {
      const token = createToken();
      await repository.createToken(user.id, token.hash, 'RESET_PASSWORD');
      try {
        await email.sendPasswordResetEmail(user.email, token.raw, user.locale ?? locale);
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
      avatar: avatarSchema,
    }), request.body);
    const user = request.authenticatedUser!;
    let avatar = profile.avatar;
    if (avatar && AVATAR_DATA_URL_PATTERN.test(avatar)) {
      const data = decodeAvatarDataUrl(avatar);
      if (!data) throw new HttpError(400, 'INVALID_AVATAR', 'La imagen del avatar no es válida.');
      avatar = await avatarStorage.save(user.id, data);
    } else if (avatar === null || !AVATAR_STORED_PATH_PATTERN.test(avatar)) {
      await avatarStorage.remove(user.id);
    } else if (avatar !== user.avatar) {
      throw new HttpError(400, 'INVALID_AVATAR', 'La ruta del avatar no es válida.');
    }
    let updated: UserRecord;
    try {
      updated = await repository.updateProfile(user.id, { ...profile, avatar });
    } catch (error) {
      if (avatar && AVATAR_STORED_PATH_PATTERN.test(avatar) && (error as { code?: string }).code === 'ER_DATA_TOO_LONG') {
        await avatarStorage.remove(user.id);
        throw new HttpError(500, 'AVATAR_MIGRATION_REQUIRED', 'La base de datos necesita la migración de avatares. Ejecuta «npm run db:migrate» y vuelve a intentarlo.');
      }
      throw error;
    }
    if (avatar && AVATAR_STORED_PATH_PATTERN.test(avatar) && updated.avatar !== avatar) {
      await avatarStorage.remove(user.id);
      throw new HttpError(500, 'AVATAR_MIGRATION_REQUIRED', 'La base de datos necesita la migración de avatares. Ejecuta «npm run db:migrate» y vuelve a intentarlo.');
    }
    response.json({ user: publicUser(updated) });
  });

  router.put('/profile/locale', authenticated, async (request, response) => {
    const { locale } = body(z.object({ locale: localeSchema }), request.body);
    const updated = await repository.updateLocale(request.authenticatedUser!.id, locale);
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
