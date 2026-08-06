import nodemailer from 'nodemailer';
import type { ServerEnvironment } from '../../config/env.js';
import type { EmailDeliveryLogRepository, EmailMessageType } from './email-delivery-log.repository.js';
import type { SmtpSettings, SmtpSettingsRepository } from './smtp-settings.repository.js';

export interface SupportEmailInput {
  ticketId: string;
  contactEmail: string;
  subject: string;
  body: string;
}

export interface EmailGateway {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
  sendAccountVerifiedEmail(email: string): Promise<void>;
  sendSupportCreatedEmail?: (input: SupportEmailInput) => Promise<void>;
  sendSupportReplyEmail?: (input: SupportEmailInput) => Promise<void>;
}

export class DevelopmentEmailGateway implements EmailGateway {
  constructor(private readonly env: ServerEnvironment) {}
  async sendVerificationEmail(email: string, token: string): Promise<void> { console.info(`Verification for ${email}: ${this.env.APP_BASE_URL}/verify-email?token=${token}`); }
  async sendPasswordResetEmail(email: string, token: string): Promise<void> { console.info(`Password reset for ${email}: ${this.env.APP_BASE_URL}/reset-password?token=${token}`); }
  async sendAccountVerifiedEmail(email: string): Promise<void> { console.info(`Account verified by the administrator for ${email}: ${this.env.APP_BASE_URL}`); }
  async sendSupportCreatedEmail(input: SupportEmailInput): Promise<void> { console.info(`Support ticket ${input.ticketId} from ${input.contactEmail}: ${input.subject}\n${input.body}`); }
  async sendSupportReplyEmail(input: SupportEmailInput): Promise<void> { console.info(`Support reply for ${input.ticketId} to ${input.contactEmail}: ${input.subject}\n${input.body}`); }
}

interface SmtpFailure extends Error { code?: string; command?: string; response?: string; }

export function describeSmtpError(error: unknown): string {
  const failure = error instanceof Error ? error as SmtpFailure : null;
  const detail = [failure?.code, failure?.command, failure?.response].filter((value): value is string => Boolean(value)).join(' \u00b7 ').slice(0, 500);
  const withDetail = (message: string) => detail ? `${message} Detalle: ${detail}` : message;
  switch (failure?.code) {
    case 'EAUTH': return withDetail('El servidor rechaz\u00f3 el usuario o la contrase\u00f1a SMTP.');
    case 'EDNS': return withDetail('No se pudo encontrar el servidor SMTP. Revisa el nombre del host.');
    case 'ECONNECTION': return withDetail('No se pudo conectar con el servidor SMTP. Revisa el host, el puerto y el cortafuegos. Si usas Cloudflare, el registro del host de correo debe estar en modo DNS only.');
    case 'ETIMEDOUT': return withDetail('La conexi\u00f3n SMTP agot\u00f3 el tiempo de espera. Si usas Cloudflare, el registro del host de correo debe estar en modo DNS only.');
    case 'ESOCKET': return withDetail('Fall\u00f3 la conexi\u00f3n segura SMTP. Revisa el puerto y la opci\u00f3n TLS o SSL.');
    case 'EENVELOPE': return withDetail('El servidor rechaz\u00f3 el remitente o el destinatario.');
    case 'EMESSAGE': return withDetail('El servidor rechaz\u00f3 el contenido del correo.');
    default: return failure?.message?.slice(0, 1000) || 'Se produjo un error SMTP desconocido.';
  }
}

export interface SmtpDeliveryResult { messageId: string | null; accepted: string[]; rejected: string[]; response: string | null; }

function emailTemplate(input: { preheader: string; title: string; heading: string; message: string; action: string; url: string; securityNote: string; appBaseUrl: string }): string {
  const logoUrl = new URL('/logo.png', input.appBaseUrl).toString();
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${input.title}</title></head><body style="margin:0;padding:0;background:#080c12;color:#eef3f8;font-family:Arial,Helvetica,sans-serif;"><span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${input.preheader}</span><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#080c12;padding:32px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#111923;border:1px solid #27384b;border-radius:14px;overflow:hidden;"><tr><td align="center" style="padding:28px 28px 20px;background:#182a3c;border-bottom:3px solid #d19d33;"><img src="${logoUrl}" width="280" alt="StarCraft: The Miniatures Game" style="display:block;max-width:100%;height:auto;border:0;"></td></tr><tr><td style="padding:32px 34px 12px;"><p style="margin:0 0 10px;color:#d19d33;font-size:12px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;">StarCraft TMG</p><h1 style="margin:0;color:#ffffff;font-size:28px;line-height:1.2;">${input.heading}</h1><p style="margin:20px 0 0;color:#c4d0dc;font-size:16px;line-height:1.6;">${input.message}</p></td></tr><tr><td align="center" style="padding:28px 34px 20px;"><a href="${input.url}" style="display:inline-block;background:#d19d33;color:#111923;text-decoration:none;font-size:16px;font-weight:bold;padding:14px 24px;border-radius:6px;">${input.action}</a></td></tr><tr><td style="padding:4px 34px 30px;"><p style="margin:0;color:#8fa1b3;font-size:13px;line-height:1.55;">${input.securityNote}</p><p style="margin:18px 0 0;color:#8fa1b3;font-size:12px;line-height:1.5;word-break:break-all;">Si el boton no funciona, copia este enlace en tu navegador:<br><a href="${input.url}" style="color:#74b9ff;">${input.url}</a></p></td></tr><tr><td style="padding:18px 34px;background:#0c121a;border-top:1px solid #27384b;"><p style="margin:0;color:#718397;font-size:12px;line-height:1.5;">Proyecto fanmade no oficial. StarCraft y sus elementos relacionados pertenecen a sus respectivos titulares.</p></td></tr></table></td></tr></table></body></html>`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

function supportEmailTemplate(input: { heading: string; intro: string; ticketId: string; subject: string; body: string; appBaseUrl: string }): string {
  const logoUrl = new URL('/logo.png', input.appBaseUrl).toString();
  const escapedBody = escapeHtml(input.body).replace(/\r?\n/g, '<br>');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(input.heading)}</title></head><body style="margin:0;padding:0;background:#080c12;color:#eef3f8;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#080c12;padding:32px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#111923;border:1px solid #27384b;border-radius:14px;overflow:hidden;"><tr><td align="center" style="padding:28px 28px 20px;background:#182a3c;border-bottom:3px solid #d19d33;"><img src="${logoUrl}" width="280" alt="StarCraft: The Miniatures Game" style="display:block;max-width:100%;height:auto;border:0;"></td></tr><tr><td style="padding:32px 34px;"><p style="margin:0 0 10px;color:#d19d33;font-size:12px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;">StarCraft TMG · Soporte</p><h1 style="margin:0;color:#ffffff;font-size:26px;line-height:1.2;">${escapeHtml(input.heading)}</h1><p style="margin:20px 0 0;color:#c4d0dc;font-size:16px;line-height:1.6;">${escapeHtml(input.intro)}</p><p style="margin:20px 0 6px;color:#8fa1b3;font-size:13px;">Ticket ${escapeHtml(input.ticketId)}</p><h2 style="margin:0 0 16px;color:#ffffff;font-size:19px;">${escapeHtml(input.subject)}</h2><div style="padding:16px;border:1px solid #27384b;border-radius:8px;background:#0c121a;color:#eef3f8;font-size:15px;line-height:1.6;">${escapedBody}</div></td></tr><tr><td style="padding:18px 34px;background:#0c121a;border-top:1px solid #27384b;"><p style="margin:0;color:#718397;font-size:12px;line-height:1.5;">Proyecto fanmade no oficial. StarCraft y sus elementos relacionados pertenecen a sus respectivos titulares.</p></td></tr></table></td></tr></table></body></html>`;
}

export class SmtpEmailGateway implements EmailGateway {
  constructor(private readonly settings: SmtpSettingsRepository, private readonly logs: EmailDeliveryLogRepository, private readonly env: ServerEnvironment) {}
  private transporter(settings: SmtpSettings) { return nodemailer.createTransport({ host: settings.host, port: settings.port, secure: settings.secure, auth: settings.username ? { user: settings.username, pass: settings.password ?? '' } : undefined, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 }); }
  private async withTimeout<T>(operation: Promise<T>, timeoutMs: number, command: string): Promise<T> { let timeout: ReturnType<typeof setTimeout> | undefined; const expired = new Promise<never>((_resolve, reject) => { timeout = setTimeout(() => reject(Object.assign(new Error(`SMTP operation timed out after ${Math.round(timeoutMs / 1000)} seconds.`), { code: 'ETIMEDOUT', command })), timeoutMs); }); try { return await Promise.race([operation, expired]); } finally { if (timeout) clearTimeout(timeout); } }
  private async deliver(input: { recipient: string; messageType: EmailMessageType; subject: string; text: string; html: string; replyTo?: string }): Promise<SmtpDeliveryResult> {
    try {
      const settings = await this.settings.get(true);
      if (!settings) throw new Error('SMTP settings have not been saved yet.');
      if (settings.username && !settings.password) throw new Error('The SMTP password is missing.');
      const transporter = this.transporter(settings);
      const result = await this.withTimeout(transporter.sendMail({ from: settings.from, to: input.recipient, replyTo: input.replyTo, subject: input.subject, text: input.text, html: input.html }), 30_000, 'CONNECT / AUTH / SEND').finally(() => transporter.close());
      const messageId = result.messageId || null; const accepted = result.accepted.map(String); const rejected = result.rejected.map(String);
      if (accepted.length === 0 || rejected.length > 0) throw Object.assign(new Error('The SMTP server did not accept the recipient.'), { code: 'EENVELOPE', command: 'RCPT TO', response: result.response });
      await this.logs.record({ recipient: input.recipient, messageType: input.messageType, subject: input.subject, status: 'SENT', providerMessageId: messageId, errorMessage: null });
      return { messageId, accepted, rejected, response: result.response || null };
    } catch (error) {
      const errorMessage = describeSmtpError(error);
      await this.logs.record({ recipient: input.recipient, messageType: input.messageType, subject: input.subject, status: 'FAILED', providerMessageId: null, errorMessage }).catch((logError) => console.error('Could not record SMTP failure.', logError));
      throw Object.assign(new Error(errorMessage), { cause: error });
    }
  }
  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const url = `${this.env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
    await this.deliver({ recipient: email, messageType: 'VERIFY_EMAIL', subject: 'StarCraft TMG - Verifica tu cuenta', text: `Verifica tu cuenta: ${url}\n\nSi no creaste esta cuenta, ignora este correo.`, html: emailTemplate({ preheader: 'Confirma tu direccion de correo para acceder a tus listas.', title: 'Verifica tu cuenta', heading: 'Confirma tu correo', message: 'Activa tu cuenta para guardar y gestionar tus listas de ejercito.', action: 'Verificar mi correo', url, securityNote: 'Si no has creado una cuenta en StarCraft TMG, puedes ignorar este correo.', appBaseUrl: this.env.APP_BASE_URL }) });
  }
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const url = `${this.env.APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await this.deliver({ recipient: email, messageType: 'RESET_PASSWORD', subject: 'StarCraft TMG - Restablece tu contrasena', text: `Restablece tu contrasena: ${url}\n\nSi no solicitaste este cambio, ignora este correo.`, html: emailTemplate({ preheader: 'Restablece de forma segura el acceso a tu cuenta.', title: 'Restablece tu contrasena', heading: 'Recupera el acceso', message: 'Hemos recibido una solicitud para cambiar la contrasena de tu cuenta.', action: 'Cambiar mi contrasena', url, securityNote: 'Si no solicitaste este cambio, puedes ignorar este correo. Tu contrasena seguira siendo la misma.', appBaseUrl: this.env.APP_BASE_URL }) });
  }
  async sendAccountVerifiedEmail(email: string): Promise<void> {
    const url = this.env.APP_BASE_URL;
    await this.deliver({ recipient: email, messageType: 'ACCOUNT_VERIFIED', subject: 'StarCraft TMG - Tu cuenta ya esta verificada', text: `Un administrador ha verificado tu cuenta manualmente. Ya puedes entrar y gestionar tus listas: ${url}\n\nSi no reconoces esta cuenta, ignora este correo.`, html: emailTemplate({ preheader: 'Un administrador ha verificado tu cuenta.', title: 'Cuenta verificada', heading: 'Tu cuenta ya esta verificada', message: 'Un administrador ha verificado tu correo manualmente. Ya puedes acceder con tu contrasena habitual y gestionar tus listas de ejercito.', action: 'Entrar en la aplicacion', url, securityNote: 'No hace falta que hagas nada mas. Si no reconoces esta cuenta, puedes ignorar este correo.', appBaseUrl: this.env.APP_BASE_URL }) });
  }
  async sendSupportCreatedEmail(input: SupportEmailInput): Promise<void> {
    const subject = `StarCraft TMG - Nuevo soporte: ${input.subject}`;
    await this.deliver({
      recipient: 'info@starcraft-builder.com',
      messageType: 'SUPPORT_CREATED',
      subject,
      text: `Nuevo soporte (${input.ticketId}) de ${input.contactEmail}\n\nAsunto: ${input.subject}\n\n${input.body}`,
      html: supportEmailTemplate({ heading: 'Nuevo soporte recibido', intro: `Solicitud enviada desde ${input.contactEmail}.`, ticketId: input.ticketId, subject: input.subject, body: input.body, appBaseUrl: this.env.APP_BASE_URL }),
    });
  }
  async sendSupportReplyEmail(input: SupportEmailInput): Promise<void> {
    const subject = `StarCraft TMG - Respuesta a tu soporte: ${input.subject}`;
    await this.deliver({
      recipient: input.contactEmail,
      messageType: 'SUPPORT_REPLY',
      subject,
      text: `Respuesta a tu soporte (${input.ticketId})\n\nAsunto: ${input.subject}\n\n${input.body}`,
      html: supportEmailTemplate({ heading: 'Respuesta de soporte', intro: 'El administrador ha respondido a tu solicitud.', ticketId: input.ticketId, subject: input.subject, body: input.body, appBaseUrl: this.env.APP_BASE_URL }),
    });
  }
  async sendTestEmail(recipient: string): Promise<SmtpDeliveryResult> {
    const url = this.env.APP_BASE_URL;
    return this.deliver({
      recipient,
      messageType: 'SMTP_TEST',
      subject: 'StarCraft TMG - Prueba SMTP',
      text: `La configuracion SMTP funciona correctamente. Abre la aplicacion: ${url}`,
      html: emailTemplate({
        preheader: 'Prueba de configuracion SMTP de StarCraft TMG.',
        title: 'Prueba SMTP',
        heading: 'Configuracion SMTP correcta',
        message: 'Este correo confirma que la aplicacion puede enviar mensajes con su plantilla HTML.',
        action: 'Abrir la aplicacion',
        url,
        securityNote: 'Si has recibido este correo, la configuracion SMTP esta funcionando correctamente.',
        appBaseUrl: this.env.APP_BASE_URL,
      }),
    });
  }
}
