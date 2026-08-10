import { Router } from 'express';
import type { Request } from 'express';
import { HttpError } from '../../lib/errors.js';
import { ListRepository } from './list.repository.js';
import { matchRecordInputSchema, type MatchRecordInput } from './match.schema.js';
import { MatchRepository } from './match.repository.js';

const MAX_MATCHES_PER_LIST = 500;

function parentListId(request: Request): string {
  const value = (request.params as Record<string, string | string[] | undefined>).id;
  if (typeof value !== 'string') throw new HttpError(404, 'LIST_NOT_FOUND', 'No existe esa lista.');
  return value;
}

function parseInput(body: unknown): MatchRecordInput {
  const parsed = matchRecordInputSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, 'INVALID_MATCH', 'Revisa los datos de la partida.');

  const today = new Date().toISOString().slice(0, 10);
  if (parsed.data.playedOn && parsed.data.playedOn > today) {
    throw new HttpError(400, 'INVALID_MATCH', 'La fecha de la partida no puede ser futura.');
  }
  if (parsed.data.opponentFactionCardId && !parsed.data.opponentRace) {
    throw new HttpError(400, 'INVALID_MATCH', 'La facción del rival necesita una raza.');
  }
  return parsed.data;
}

export function createMatchRouter(lists: ListRepository, matches: MatchRepository): Router {
  const router = Router({ mergeParams: true });

  router.use(async (request, _response, next) => {
    const list = await lists.findForOwner(parentListId(request), request.authenticatedUser!.id);
    if (!list) throw new HttpError(404, 'LIST_NOT_FOUND', 'No existe esa lista.');
    next();
  });

  router.get('/', async (request, response) => {
    const ownerId = request.authenticatedUser!.id;
    const listId = parentListId(request);
    const [records, summary] = await Promise.all([
      matches.listForList(listId, ownerId),
      matches.summaryForList(listId, ownerId),
    ]);
    response.json({ matches: records, summary });
  });

  router.post('/', async (request, response) => {
    const ownerId = request.authenticatedUser!.id;
    const listId = parentListId(request);
    const input = parseInput(request.body);
    if (await matches.countForList(listId, ownerId) >= MAX_MATCHES_PER_LIST) {
      throw new HttpError(409, 'MATCH_LIMIT_REACHED', 'Esta lista ya tiene el máximo de partidas registradas.');
    }
    const match = await matches.create(listId, ownerId, input);
    const summary = await matches.summaryForList(listId, ownerId);
    response.status(201).json({ match, summary });
  });

  router.put('/:matchId', async (request, response) => {
    const ownerId = request.authenticatedUser!.id;
    const listId = parentListId(request);
    const input = parseInput(request.body);
    const match = await matches.update(request.params.matchId!, listId, ownerId, input);
    if (!match) throw new HttpError(404, 'MATCH_NOT_FOUND', 'Esa partida ya no existe.');
    const summary = await matches.summaryForList(listId, ownerId);
    response.json({ match, summary });
  });

  router.delete('/:matchId', async (request, response) => {
    const ownerId = request.authenticatedUser!.id;
    const listId = parentListId(request);
    const deleted = await matches.delete(request.params.matchId!, listId, ownerId);
    if (!deleted) throw new HttpError(404, 'MATCH_NOT_FOUND', 'Esa partida ya no existe.');
    const summary = await matches.summaryForList(listId, ownerId);
    response.json({ summary });
  });

  return router;
}
