import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import type { ServerEnvironment } from '../../config/env.js';

export const SESSION_COOKIE = 'sctmg_session';

export interface SessionPayload {
  sub: string;
  sv: number;
}

export function issueSession(response: Response, userId: string, sessionVersion: number, env: ServerEnvironment): void {
  const token = jwt.sign({ sub: userId, sv: sessionVersion }, env.SESSION_SECRET, { expiresIn: '15m' });
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 15,
    path: '/api',
  });
}

export function clearSession(response: Response, env: ServerEnvironment): void {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api',
  });
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
