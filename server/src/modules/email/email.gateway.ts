import type { ServerEnvironment } from '../../config/env.js';

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
