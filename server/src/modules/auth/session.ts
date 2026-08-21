import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import type { ServerEnvironment } from '../../config/env.js';

export const SESSION_COOKIE = 'sctmg_session';
export const SESSION_TTL_SECONDS = 60 * 60;
export const SESSION_TTL_MS = SESSION_TTL_SECONDS * 1000;

export interface SessionPayload {
  sub: string;
  sv: number;
}

export function issueSession(response: Response, userId: string, sessionVersion: number, env: ServerEnvironment): void {
  const token = jwt.sign({ sub: userId, sv: sessionVersion }, env.SESSION_SECRET, { expiresIn: SESSION_TTL_SECONDS });
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/api',
  });
}

export function clearSession(response: Response, env: ServerEnvironment): void {
  const options = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  };
  response.clearCookie(SESSION_COOKIE, { ...options, path: '/api' });
  // Elimina también sesiones creadas por versiones antiguas o por una
  // configuración de proxy que usase la raíz como ámbito de la cookie.
  response.clearCookie(SESSION_COOKIE, { ...options, path: '/' });
}

export function readSession(token: string, env: ServerEnvironment): SessionPayload | null {
  try {
    const parsed = jwt.verify(token, env.SESSION_SECRET);
    if (typeof parsed !== 'object' || typeof parsed.sub !== 'string' || typeof parsed.sv !== 'number') {
      return null;
    }
    return { sub: parsed.sub, sv: parsed.sv };
  } catch {
    return null;
  }
}
