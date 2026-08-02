import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import { Router } from 'express';
import { z } from 'zod';
import type { ServerEnvironment } from '../../config/env.js';
import { HttpError } from '../../lib/errors.js';
import { requireUser } from '../../middleware/require-user.js';
import type { EmailGateway } from '../email/email.gateway.js';
import { AuthRepository, type UserRecord } from './auth.repository.js';
import { clearSession, issueSession } from './session.js';

const passwordSchema = z.string().min(12).max(128);
const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: passwordSchema,
});
const tokenSchema = z.object({ token: z.string().min(32).max(512) });

function normalizeEmail(email: string): string {
  return email.trim().toLocaleLowerCase('en-US');
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

  router.post('/register', async (request, response) => {
    const { email: inputEmail, password } = body(credentialsSchema, request.body);
    const emailNormalized = normalizeEmail(inputEmail);
    const existing = await repository.findByEmail(emailNormalized);
    if (existing) throw new HttpError(409, 'EMAIL_UNAVAILABLE', 'No se pudo crear la cuenta con ese correo.');

    const user = await repository.createUser(inputEmail.trim(), emailNormalized, await hashPassword(password));
    const token = createToken();
    await repository.createToken(user.id, token.hash, 'VERIFY_EMAIL');
    await email.sendVerificationEmail(user.email, token.raw);
    response.status(201).json({
      user: publicUser(user),
      verificationRequired: true,
      developmentVerificationUrl: env.NODE_ENV === 'development'
        ? `${env.APP_BASE_URL}/verify-email?token=${token.raw}`
        : null,
    });
  });

  router.post('/login', async (request, response) => {
    const { email: inputEmail, password } = body(credentialsSchema, request.body);
    const user = await repository.findByEmail(normalizeEmail(inputEmail));
    const valid = user && !user.deletedAt && await argon2.verify(user.passwordHash, password);
    if (!valid) throw new HttpError(401, 'INVALID_CREDENTIALS', 'Correo o contraseña incorrectos.');
    issueSession(response, user.id, user.sessionVersion, env);
    response.json({ user: publicUser(user) });
  });

  router.post('/logout', (_request, response) => {
    clearSession(response, env);
    response.status(204).end();
  });

  router.post('/verify-email', async (request, response) => {
    const { token } = body(tokenSchema, request.body);
    const user = await repository.consumeToken(createHash('sha256').update(token).digest('hex'), 'VERIFY_EMAIL');
    if (!user || user.deletedAt) throw new HttpError(400, 'INVALID_TOKEN', 'El enlace de verificación no es válido o ha caducado.');
    await repository.verifyEmail(user.id);
    response.status(204).end();
  });

  router.post('/request-password-reset', async (request, response) => {
    const { email: inputEmail } = body(z.object({ email: z.string().email().max(254) }), request.body);
    const user = await repository.findByEmail(normalizeEmail(inputEmail));
    if (user && !user.deletedAt) {
      const token = createToken();
      await repository.createToken(user.id, token.hash, 'RESET_PASSWORD');
      await email.sendPasswordResetEmail(user.email, token.raw);
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
    if (!await argon2.verify(user.passwordHash, currentPassword)) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'La contraseña actual no es correcta.');
    }
    const updated = await repository.updatePassword(user.id, await hashPassword(newPassword));
    issueSession(response, updated.id, updated.sessionVersion, env);
    response.status(204).end();
  });

  router.delete('/account', authenticated, async (request, response) => {
    const { password } = body(z.object({ password: passwordSchema }), request.body);
    const user = request.authenticatedUser!;
    if (!await argon2.verify(user.passwordHash, password)) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'La contraseña no es correcta.');
    }
    await repository.softDeleteUser(user.id);
    clearSession(response, env);
    response.status(204).end();
  });

  return router;
}
