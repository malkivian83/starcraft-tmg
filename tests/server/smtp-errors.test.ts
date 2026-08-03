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
});
