import { randomBytes, randomUUID } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { ServerEnvironment } from '../../config/env.js';
import { HttpError } from '../../lib/errors.js';
import { optionalUser } from '../../middleware/require-user.js';
import type { AuthRepository } from '../auth/auth.repository.js';
import { commandSchema, createGameSchema, linkListSchema } from './game.schema.js';
import type { GamePrincipal } from './game.repository.js';
import { GameRepository } from './game.repository.js';

export const GAME_GUEST_COOKIE = 'sctmg_game_guest';

declare global {
  namespace Express {
    interface Request {
      gamePrincipal?: GamePrincipal;
    }
  }
}

function guestCookieOptions(env: ServerEnvironment) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 1000 * 60 * 60 * 24 * 365 * 5,
    path: '/api/games',
  };
}

function expectedRevision(request: Request): number {
  const value = z.coerce.number().int().positive().safeParse(request.header('if-match'));
  if (!value.success) throw new HttpError(428, 'REVISION_REQUIRED', 'Incluye la revisión actual de la partida.');
  return value.data;
}

async function resolvePrincipal(repository: GameRepository, env: ServerEnvironment, request: Request, response: Response): Promise<GamePrincipal> {
  if (request.authenticatedUser?.emailVerifiedAt) {
    return { type: 'ACCOUNT', accountId: request.authenticatedUser.id, guestId: null };
  }
  let token = request.cookies?.[GAME_GUEST_COOKIE];
  if (typeof token !== 'string' || token.length < 32) {
    token = randomBytes(32).toString('base64url');
    response.cookie(GAME_GUEST_COOKIE, token, guestCookieOptions(env));
  }
  const guestId = await repository.ensureGuest(token);
  return { type: 'GUEST', accountId: null, guestId };
}

function requirePrincipal(request: Request): GamePrincipal {
  if (!request.gamePrincipal) throw new HttpError(401, 'UNAUTHENTICATED', 'No se pudo resolver el propietario de la partida.');
  return request.gamePrincipal;
}

export function createGameRouter(repository: GameRepository, authRepository: AuthRepository, env: ServerEnvironment): Router {
  const router = Router();
  router.use(optionalUser(authRepository, env));
  router.use(async (request: Request, response: Response, next: NextFunction) => {
    try {
      request.gamePrincipal = await resolvePrincipal(repository, env, request, response);
      next();
    } catch (error) {
      next(error);
    }
  });

  router.get('/', async (request, response) => {
    response.json({ games: await repository.list(requirePrincipal(request)) });
  });

  router.get('/guest', async (request, response) => {
    if (!request.authenticatedUser?.emailVerifiedAt) throw new HttpError(401, 'UNAUTHENTICATED', 'Inicia sesión para revisar tus partidas invitadas.');
    const token = request.cookies?.[GAME_GUEST_COOKIE];
    if (typeof token !== 'string') { response.json({ games: [] }); return; }
    const guestId = await repository.ensureGuest(token);
    response.json({ games: await repository.list({ type: 'GUEST', accountId: null, guestId }) });
  });

  router.post('/', async (request, response) => {
    const parsed = createGameSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_GAME', 'La configuración de la partida no es válida.');
    const game = await repository.create(randomUUID(), requirePrincipal(request), parsed.data);
    response.status(201).json({ game });
  });

  router.get('/:id', async (request, response) => {
    const game = await repository.find(request.params.id, requirePrincipal(request));
    if (!game) throw new HttpError(404, 'GAME_NOT_FOUND', 'No existe esa partida.');
    response.json({ game });
  });

  router.post('/:id/commands', async (request, response) => {
    const parsed = commandSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_GAME_COMMAND', 'La acción de la partida no es válida.');
    const game = await repository.command(request.params.id, requirePrincipal(request), expectedRevision(request), parsed.data);
    if (!game) throw new HttpError(404, 'GAME_NOT_FOUND', 'No existe esa partida.');
    response.json({ game });
  });

  router.post('/:id/link-list', async (request, response) => {
    const parsed = linkListSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_GAME_LINK', 'La asociación de la partida no es válida.');
    const game = await repository.linkList(request.params.id, requirePrincipal(request), expectedRevision(request), parsed.data);
    if (!game) throw new HttpError(404, 'GAME_NOT_FOUND', 'No existe esa partida.');
    response.json({ game });
  });

  router.post('/:id/claim', async (request, response) => {
    const account = request.authenticatedUser;
    if (!account?.emailVerifiedAt) throw new HttpError(401, 'UNAUTHENTICATED', 'Inicia sesión para guardar la partida en tu cuenta.');
    const token = request.cookies?.[GAME_GUEST_COOKIE];
    if (typeof token !== 'string') throw new HttpError(400, 'GUEST_IDENTITY_NOT_FOUND', 'No se encontró la identidad invitada de este navegador.');
    const guestId = await repository.ensureGuest(token);
    const game = await repository.claim(request.params.id, guestId, account.id);
    if (!game) throw new HttpError(404, 'GAME_NOT_FOUND', 'No existe esa partida invitada.');
    response.json({ game });
  });

  router.delete('/:id', async (request, response) => {
    const deleted = await repository.delete(request.params.id, requirePrincipal(request));
    if (!deleted) throw new HttpError(404, 'GAME_NOT_FOUND', 'No existe esa partida.');
    response.status(204).end();
  });

  return router;
}
