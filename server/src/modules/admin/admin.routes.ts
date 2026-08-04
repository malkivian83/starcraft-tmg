import argon2 from 'argon2';
import { Router } from 'express';
import { z } from 'zod';
import type { ServerEnvironment } from '../../config/env.js';
import { HttpError } from '../../lib/errors.js';
import { requireUser } from '../../middleware/require-user.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { EmailDeliveryLogRepository } from '../email/email-delivery-log.repository.js';
import { describeSmtpError, type EmailGateway, SmtpEmailGateway } from '../email/email.gateway.js';
import { SmtpSettingsRepository } from '../email/smtp-settings.repository.js';

const SUPER_ADMIN_EMAIL = 'malkivian@gmail.com';

function requireSuperAdmin(repository: AuthRepository, env: ServerEnvironment) {
  const authenticated = requireUser(repository, env);
  return [authenticated, (request: Parameters<typeof authenticated>[0], _response: Parameters<typeof authenticated>[1], next: Parameters<typeof authenticated>[2]) => {
    if (request.authenticatedUser?.email.trim().toLowerCase() !== SUPER_ADMIN_EMAIL) return next(new HttpError(403, 'FORBIDDEN', 'Acceso reservado al superadministrador.'));
    next();
  }];
}

export function createAdminRouter(
  repository: AuthRepository,
  smtp: SmtpSettingsRepository,
  emailLogs: EmailDeliveryLogRepository,
  smtpEmail: SmtpEmailGateway,
  email: EmailGateway,
  env: ServerEnvironment,
): Router {
  const router = Router();
  router.use(...requireSuperAdmin(repository, env));
  router.get('/users', async (_request, response) => response.json({ users: await repository.listUsersForAdmin() }));
  router.put('/users/:id/active', async (request, response) => {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(request.body);
    if (request.params.id === request.authenticatedUser!.id && !isActive) throw new HttpError(400, 'INVALID_INPUT', 'No puedes desactivar tu propia cuenta de superadministrador.');
    await repository.setUserActive(request.params.id, isActive);
    response.status(204).end();
  });
  router.put('/users/:id/verified', async (request, response) => {
    const { isVerified } = z.object({ isVerified: z.boolean() }).parse(request.body);
    if (request.params.id === request.authenticatedUser!.id && !isVerified) throw new HttpError(400, 'INVALID_INPUT', 'No puedes retirar la verificación de tu propia cuenta de superadministrador.');
    const user = await repository.findById(request.params.id);
    if (!user) throw new HttpError(404, 'NOT_FOUND', 'La cuenta indicada no existe.');
    const wasVerified = Boolean(user.emailVerifiedAt);
    await repository.setEmailVerified(user.id, isVerified);
    // El aviso es informativo: si el correo falla, la verificación ya está hecha
    // y el superadministrador recibe la advertencia en lugar de un error.
    let emailDeliveryWarning: string | null = null;
    if (isVerified && !wasVerified) {
      try { await email.sendAccountVerifiedEmail(user.email); }
      catch (error) { emailDeliveryWarning = `La cuenta quedó verificada, pero no se pudo avisar por correo: ${error instanceof Error ? error.message : 'error desconocido'}`; }
    }
    response.json({ emailDeliveryWarning });
  });
  router.put('/users/:id/password', async (request, response) => {
    const { password } = z.object({ password: z.string().min(12).max(128) }).parse(request.body);
    await repository.updatePassword(request.params.id, await argon2.hash(password, { type: argon2.argon2id }));
    response.status(204).end();
  });
  router.get('/smtp', async (_request, response) => response.json({ smtp: await smtp.get() }));
  router.put('/smtp', async (request, response) => {
    const value = z.object({ host: z.string().min(1).max(255), port: z.number().int().min(1).max(65535), secure: z.boolean(), username: z.string().max(255), from: z.string().email(), password: z.string().max(512).optional() }).parse(request.body);
    await smtp.save(value);
    response.status(204).end();
  });
  router.post('/smtp/test', async (request, response) => {
    const { recipient } = z.object({ recipient: z.string().email().max(254) }).parse(request.body);
    try {
      const result = await smtpEmail.sendTestEmail(recipient);
      response.json({ result: { ok: true, ...result } });
    } catch (error) {
      throw new HttpError(502, 'SMTP_TEST_FAILED', describeSmtpError(error));
    }
  });
  router.get('/smtp/logs', async (request, response) => {
    const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(250).default(100) }).parse(request.query);
    response.json({ logs: await emailLogs.list(limit) });
  });
  return router;
}
