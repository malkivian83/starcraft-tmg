import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import type { ServerEnvironment } from '../../config/env.js';
import { HttpError } from '../../lib/errors.js';

export interface GoogleIdentity {
  sub: string;
  email: string;
  emailNormalized: string;
  nickname: string | null;
}

export type GoogleVerifier = (credential: string) => Promise<GoogleIdentity>;

/**
 * Traduce el contenido del token de Google a la identidad que guarda la
 * aplicación. Se exige `email_verified` porque es lo único que justifica saltarse
 * la verificación propia y vincular con una cuenta previa del mismo correo: sin
 * esa garantía, cualquiera podría reclamar el correo de otro.
 */
export function resolveGoogleIdentity(payload: Partial<TokenPayload> | null | undefined): GoogleIdentity {
  if (!payload?.sub || !payload.email) throw new HttpError(401, 'INVALID_GOOGLE_TOKEN', 'La cuenta de Google no se pudo validar.');
  if (payload.email_verified !== true) throw new HttpError(401, 'GOOGLE_EMAIL_UNVERIFIED', 'Google no confirma que ese correo sea tuyo.');
  const nickname = payload.name?.trim().slice(0, 32) ?? '';
  return {
    sub: payload.sub,
    email: payload.email.trim(),
    emailNormalized: payload.email.trim().toLocaleLowerCase('en-US'),
    nickname: nickname.length >= 2 ? nickname : null,
  };
}

export function createGoogleVerifier(env: ServerEnvironment): GoogleVerifier | null {
  if (!env.GOOGLE_CLIENT_ID) return null;
  const clientId = env.GOOGLE_CLIENT_ID;
  const client = new OAuth2Client(clientId);
  return async (credential: string) => {
    let payload: TokenPayload | undefined;
    try {
      // Comprueba firma, emisor, destinatario y caducidad; nunca decodificar a mano.
      const ticket = await client.verifyIdToken({ idToken: credential, audience: clientId });
      payload = ticket.getPayload();
    } catch (error) {
      console.error('El token de Google no superó la verificación.', error);
      throw new HttpError(401, 'INVALID_GOOGLE_TOKEN', 'La cuenta de Google no se pudo validar.');
    }
    return resolveGoogleIdentity(payload);
  };
}
