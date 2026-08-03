import nodemailer from 'nodemailer';
import type { ServerEnvironment } from '../../config/env.js';
import type { EmailDeliveryLogRepository, EmailMessageType } from './email-delivery-log.repository.js';
import type { SmtpSettings, SmtpSettingsRepository } from './smtp-settings.repository.js';

export interface EmailGateway {
  sendVerificationEmail(email: string, token: string): Promise<void>;
  sendPasswordResetEmail(email: string, token: string): Promise<void>;
}

/** Sólo para desarrollo local: producción debe sustituirlo por un proveedor SMTP. */
export class DevelopmentEmailGateway implements EmailGateway {
  constructor(private readonly env: ServerEnvironment) {}

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    console.info(`Verificación para ${email}: ${this.env.APP_BASE_URL}/verify-email?token=${token}`);
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    console.info(`Restablecimiento para ${email}: ${this.env.APP_BASE_URL}/reset-password?token=${token}`);
  }
}

interface SmtpFailure extends Error {
  code?: string;
  command?: string;
  response?: string;
}

export function describeSmtpError(error: unknown): string {
  const failure = error instanceof Error ? error as SmtpFailure : null;
  const detail = [failure?.code, failure?.command, failure?.response]
    .filter((value): value is string => Boolean(value))
    .join(' · ')
    .slice(0, 500);
  const withDetail = (message: string) => detail ? `${message} Detalle: ${detail}` : message;
  switch (failure?.code) {
    case 'EAUTH': return withDetail('El servidor rechazó el usuario o la contraseña SMTP.');
    case 'EDNS': return withDetail('No se pudo encontrar el servidor SMTP. Revisa el nombre del host.');
    case 'ECONNECTION': return withDetail('No se pudo conectar con el servidor SMTP. Revisa el host, el puerto y el cortafuegos.');
    case 'ETIMEDOUT': return withDetail('La conexión SMTP agotó el tiempo de espera.');
    case 'ESOCKET': return withDetail('Falló la conexión segura SMTP. Revisa el puerto y la opción TLS/SSL.');
    case 'EENVELOPE': return withDetail('El servidor rechazó el remitente o el destinatario.');
    case 'EMESSAGE': return withDetail('El servidor rechazó el contenido del correo.');
    default: return failure?.message?.slice(0, 1000) || 'Se produjo un error SMTP desconocido.';
  }
}

export interface SmtpDeliveryResult {
  messageId: string | null;
  accepted: string[];
  rejected: string[];
  response: string | null;
}

export class SmtpEmailGateway implements EmailGateway {
  constructor(
    private readonly settings: SmtpSettingsRepository,
    private readonly logs: EmailDeliveryLogRepository,
    private readonly env: ServerEnvironment,
  ) {}

  private transporter(settings: SmtpSettings) {
    return nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: settings.secure,
      auth: settings.username
        ? { user: settings.username, pass: settings.password ?? '' }
        : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 30_000,
    });
  }

  private async deliver(input: {
    recipient: string;
    messageType: EmailMessageType;
    subject: string;
    text: string;
    html: string;
    verifyConnection?: boolean;
  }): Promise<SmtpDeliveryResult> {
    try {
      const settings = await this.settings.get(true);
      if (!settings) throw new Error('La configuración SMTP todavía no se ha guardado.');
      if (settings.username && !settings.password) throw new Error('Falta la contraseña SMTP.');
      const transporter = this.transporter(settings);
      if (input.verifyConnection) await transporter.verify();
      const result = await transporter.sendMail({
        from: settings.from,
        to: input.recipient,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      const messageId = result.messageId || null;
      const accepted = result.accepted.map(String);
      const rejected = result.rejected.map(String);
      if (accepted.length === 0 || rejected.length > 0) {
        throw Object.assign(new Error('El servidor SMTP no aceptó el destinatario.'), {
          code: 'EENVELOPE',
          command: 'RCPT TO',
          response: result.response,
        });
      }
      await this.logs.record({
        recipient: input.recipient,
        messageType: input.messageType,
        subject: input.subject,
        status: 'SENT',
        providerMessageId: messageId,
        errorMessage: null,
      });
      return { messageId, accepted, rejected, response: result.response || null };
    } catch (error) {
      const errorMessage = describeSmtpError(error);
      await this.logs.record({
        recipient: input.recipient,
        messageType: input.messageType,
        subject: input.subject,
        status: 'FAILED',
        providerMessageId: null,
        errorMessage,
      }).catch((logError) => console.error('No se pudo registrar el fallo SMTP.', logError));
      throw Object.assign(new Error(errorMessage), { cause: error });
    }
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    const url = `${this.env.APP_BASE_URL}/verify-email?token=${encodeURIComponent(token)}`;
    await this.deliver({
      recipient: email,
      messageType: 'VERIFY_EMAIL',
      subject: 'Verifica tu cuenta · StarCraft TMG',
      text: `Verifica tu cuenta abriendo este enlace: ${url}`,
      html: `<p>Verifica tu cuenta abriendo el siguiente enlace:</p><p><a href="${url}">Verificar mi correo</a></p>`,
    });
  }

  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const url = `${this.env.APP_BASE_URL}/reset-password?token=${encodeURIComponent(token)}`;
    await this.deliver({
      recipient: email,
      messageType: 'RESET_PASSWORD',
      subject: 'Restablece tu contraseña · StarCraft TMG',
      text: `Restablece tu contraseña abriendo este enlace: ${url}`,
      html: `<p>Restablece tu contraseña abriendo el siguiente enlace:</p><p><a href="${url}">Cambiar mi contraseña</a></p>`,
    });
  }

  async sendTestEmail(recipient: string): Promise<SmtpDeliveryResult> {
    return this.deliver({
      recipient,
      messageType: 'SMTP_TEST',
      subject: 'Prueba SMTP · StarCraft TMG',
      text: 'La configuración SMTP funciona correctamente.',
      html: '<p>La configuración SMTP funciona correctamente.</p>',
      verifyConnection: true,
    });
  }
}
