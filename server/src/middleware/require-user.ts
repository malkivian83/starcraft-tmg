import type { NextFunction, Request, Response } from 'express';
import type { ServerEnvironment } from '../config/env.js';
import { HttpError } from '../lib/errors.js';
import { AuthRepository, type UserRecord } from '../modules/auth/auth.repository.js';
import { SESSION_COOKIE, readSession } from '../modules/auth/session.js';

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: UserRecord;
    }
  }
}

export function requireUser(repository: AuthRepository, env: ServerEnvironment) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    const token = request.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string') return next(new HttpError(401, 'UNAUTHENTICATED', 'Inicia sesión para continuar.'));

    const session = readSession(token, env);
    if (!session) return next(new HttpError(401, 'UNAUTHENTICATED', 'La sesión no es válida.'));

    try {
      const user = await repository.findById(session.sub);
      if (!user || user.deletedAt || !user.isActive || user.sessionVersion !== session.sv) {
        return next(new HttpError(401, 'UNAUTHENTICATED', 'La sesión no es válida.'));
      }
      request.authenticatedUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Resuelve la sesión si existe, pero conserva el acceso público sin cookie. */
export function optionalUser(repository: AuthRepository, env: ServerEnvironment) {
  return async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
    const token = request.cookies?.[SESSION_COOKIE];
    if (typeof token !== 'string') return next();

    const session = readSession(token, env);
    if (!session) return next();

    try {
      const user = await repository.findById(session.sub);
      if (user && !user.deletedAt && user.isActive && user.sessionVersion === session.sv) request.authenticatedUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireVerifiedUser(request: Request, _response: Response, next: NextFunction): void {
  if (!request.authenticatedUser?.emailVerifiedAt) {
    return next(new HttpError(403, 'EMAIL_NOT_VERIFIED', 'Verifica tu correo para acceder a la aplicación.'));
  }
  next();
}
