import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import type { ServerEnvironment } from '../../config/env.js';
import { HttpError } from '../../lib/errors.js';
import { optionalUser } from '../../middleware/require-user.js';
import { rateLimit } from '../../middleware/rate-limit.js';
import { AuthRepository } from '../auth/auth.repository.js';
import type { EmailGateway } from '../email/email.gateway.js';
import { SupportRepository } from './support.repository.js';

export const SUPPORT_TERMS_VERSION = '2026-08-05';

const supportSchema = z.object({
  subject: z.string().trim().min(3).max(160).refine((value) => !/[\r\n]/.test(value), 'El asunto no es válido.'),
  contactEmail: z.string().trim().email().max(254),
  message: z.string().trim().min(10).max(10000),
  termsAccepted: z.literal(true),
  locale: z.enum(['es', 'en']).default('es'),
});

function parseBody(input: unknown): z.infer<typeof supportSchema> {
  const parsed = supportSchema.safeParse(input);
  if (!parsed.success) throw new HttpError(400, 'INVALID_INPUT', 'Completa el formulario de soporte correctamente y acepta las condiciones.');
  return parsed.data;
}

function rateKey(request: Parameters<ReturnType<typeof rateLimit>>[0]): string {
  const email = typeof request.body?.contactEmail === 'string' ? request.body.contactEmail.trim().toLowerCase() : '';
  const identity = createHash('sha256').update(email || 'missing-email').digest('hex');
  return `${request.ip}:${identity}`;
}

export function createSupportRouter(repository: SupportRepository, authRepository: AuthRepository, email: EmailGateway, env: ServerEnvironment): Router {
  const router = Router();
  const byIp = rateLimit({ windowMs: 60 * 60 * 1000, max: 12, message: 'Has enviado demasiadas solicitudes de soporte. Espera un rato antes de volver a intentarlo.' });
  const byIdentity = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, key: rateKey, message: 'Has enviado demasiadas solicitudes de soporte con este correo. Espera un rato antes de volver a intentarlo.' });
  router.use(optionalUser(authRepository, env));

  router.post('/', byIp, byIdentity, async (request, response) => {
    const input = parseBody(request.body);
    const user = request.authenticatedUser;
    const created = await repository.createTicket({
      userId: user?.id ?? null,
      contactEmail: input.contactEmail,
      subject: input.subject,
      body: input.message,
      termsVersion: SUPPORT_TERMS_VERSION,
      locale: input.locale,
    });

    let emailDeliveryWarning: string | null = null;
    try {
      if (!email.sendSupportCreatedEmail) throw new Error('El correo de soporte no está disponible en este entorno.');
      await email.sendSupportCreatedEmail({ ticketId: created.ticket.id, contactEmail: created.ticket.contactEmail, subject: created.ticket.subject, body: input.message, locale: input.locale });
      await repository.markMessageDelivery(created.message.id, 'SENT', null, null);
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'error desconocido';
      emailDeliveryWarning = `La solicitud se ha guardado, pero no se pudo avisar al soporte: ${detail}`;
      await repository.markMessageDelivery(created.message.id, 'FAILED', null, detail);
    }

    response.status(201).json({ ticketId: created.ticket.id, emailDeliveryWarning });
  });
  return router;
}
