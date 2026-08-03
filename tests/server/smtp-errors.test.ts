import { describe, expect, it } from 'vitest';
import { describeSmtpError } from '../../server/src/modules/email/email.gateway';

describe('diagnóstico SMTP', () => {
  it.each([
    ['EAUTH', 'usuario o la contraseña'],
    ['EDNS', 'encontrar el servidor'],
    ['ECONNECTION', 'conectar con el servidor'],
    ['ETIMEDOUT', 'tiempo de espera'],
    ['ESOCKET', 'conexión segura'],
  ])('explica el error %s', (code, expectedMessage) => {
    const error = Object.assign(new Error('detalle técnico'), { code });
    expect(describeSmtpError(error)).toContain(expectedMessage);
  });

  it('conserva un mensaje desconocido sin exceder el límite del registro', () => {
    expect(describeSmtpError(new Error('x'.repeat(1200)))).toHaveLength(1000);
  });

  it('incluye la respuesta técnica segura del servidor', () => {
    const error = Object.assign(new Error('falló la autenticación'), {
      code: 'EAUTH', command: 'AUTH PLAIN', response: '535 5.7.8 Authentication failed',
    });
    expect(describeSmtpError(error)).toContain('EAUTH · AUTH PLAIN · 535 5.7.8');
  });
});
