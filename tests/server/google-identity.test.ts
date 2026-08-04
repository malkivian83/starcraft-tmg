import { describe, expect, it } from 'vitest';
import { HttpError } from '../../server/src/lib/errors';
import { resolveGoogleIdentity } from '../../server/src/modules/auth/google';
import { authProviderOf } from '../../server/src/modules/auth/auth.repository';

const validPayload = { sub: '110123456789', email: 'Jugador@Gmail.com', email_verified: true, name: 'Sarah Kerrigan' };

describe('identidad de Google', () => {
  it('normaliza el correo y conserva el identificador estable', () => {
    const identity = resolveGoogleIdentity(validPayload);
    expect(identity).toEqual({ sub: '110123456789', email: 'Jugador@Gmail.com', emailNormalized: 'jugador@gmail.com', nickname: 'Sarah Kerrigan' });
  });

  it('rechaza un correo que Google no confirma como propio', () => {
    // Es la garantía que permite saltarse la verificación y vincular cuentas
    // existentes por correo: sin ella, cualquiera podría reclamar otro correo.
    expect(() => resolveGoogleIdentity({ ...validPayload, email_verified: false }))
      .toThrow(expect.objectContaining({ status: 401, code: 'GOOGLE_EMAIL_UNVERIFIED' }) as HttpError);
  });

  it.each([
    ['sin sub', { ...validPayload, sub: undefined }],
    ['sin correo', { ...validPayload, email: undefined }],
    ['vacío', null],
  ])('rechaza un token %s', (_case, payload) => {
    expect(() => resolveGoogleIdentity(payload)).toThrow(expect.objectContaining({ status: 401, code: 'INVALID_GOOGLE_TOKEN' }) as HttpError);
  });

  it('descarta un nombre demasiado corto y recorta el largo al límite del perfil', () => {
    expect(resolveGoogleIdentity({ ...validPayload, name: 'K' }).nickname).toBeNull();
    expect(resolveGoogleIdentity({ ...validPayload, name: 'K'.repeat(40) }).nickname).toHaveLength(32);
  });
});

describe('proveedor de acceso', () => {
  it.each([
    ['PASSWORD', { passwordHash: 'argon2', googleSub: null }],
    ['GOOGLE', { passwordHash: null, googleSub: '110123456789' }],
    ['BOTH', { passwordHash: 'argon2', googleSub: '110123456789' }],
  ])('describe la cuenta como %s', (expected, user) => {
    expect(authProviderOf(user)).toBe(expected);
  });
});
