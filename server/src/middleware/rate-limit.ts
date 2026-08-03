import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors.js';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  key?: (request: Request) => string;
  message?: string;
}

/**
 * Limitador en memoria para los puntos de entrada públicos.
 *
 * No pretende sustituir un límite distribuido en un despliegue con varias
 * instancias, pero evita fuerza bruta y abuso SMTP en el proceso actual. La
 * clave puede combinar IP e identidad sin almacenar datos sensibles en claro.
 */
export function rateLimit(options: RateLimitOptions) {
  const entries = new Map<string, RateLimitEntry>();
  let requestsSinceCleanup = 0;

  return (request: Request, response: Response, next: NextFunction): void => {
    const now = Date.now();
    requestsSinceCleanup++;
    if (requestsSinceCleanup >= 100) {
      requestsSinceCleanup = 0;
      for (const [key, entry] of entries) {
        if (entry.resetAt <= now) entries.delete(key);
      }
    }

    const key = options.key?.(request) ?? request.ip ?? 'unknown-client';
    const existing = entries.get(key);
    const entry = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : existing;

    if (entry.count >= options.max) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return next(new HttpError(429, 'RATE_LIMITED', options.message ?? 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.'));
    }

    entry.count++;
    entries.set(key, entry);
    next();
  };
}
