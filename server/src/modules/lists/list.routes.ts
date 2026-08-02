import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/errors.js';
import { requireVerifiedUser } from '../../middleware/require-user.js';
import { ListRepository, type SavedListRecord } from './list.repository.js';
import { armyListPayloadSchema } from './list.schema.js';

function payload(record: SavedListRecord) {
  return { ...record.payload, revision: record.revision, remoteUpdatedAt: record.updatedAt };
}

function expectedRevision(input: string | undefined): number {
  const parsed = z.coerce.number().int().positive().safeParse(input);
  if (!parsed.success) throw new HttpError(428, 'REVISION_REQUIRED', 'Incluye la revisión actual de la lista.');
  return parsed.data;
}

export function createListRouter(repository: ListRepository): Router {
  const router = Router();
  router.use(requireVerifiedUser);

  router.get('/', async (request, response) => {
    const lists = await repository.listForOwner(request.authenticatedUser!.id);
    response.json({ lists: lists.map(payload) });
  });

  router.get('/:id', async (request, response) => {
    const list = await repository.findForOwner(request.params.id, request.authenticatedUser!.id);
    if (!list) throw new HttpError(404, 'LIST_NOT_FOUND', 'No existe esa lista.');
    response.json({ list: payload(list) });
  });

  router.post('/', async (request, response) => {
    const parsed = armyListPayloadSchema.safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_LIST', 'La lista no tiene un formato válido.');
    const existing = await repository.findForOwner(parsed.data.id, request.authenticatedUser!.id);
    if (existing) throw new HttpError(409, 'LIST_EXISTS', 'Ya existe una lista con ese identificador.');
    const saved = await repository.create(request.authenticatedUser!.id, parsed.data);
    response.status(201).json({ list: payload(saved) });
  });

  router.put('/:id', async (request, response) => {
    const parsed = armyListPayloadSchema.safeParse(request.body);
    if (!parsed.success || parsed.data.id !== request.params.id) {
      throw new HttpError(400, 'INVALID_LIST', 'La lista no tiene un formato válido.');
    }
    const saved = await repository.update(
      request.params.id,
      request.authenticatedUser!.id,
      expectedRevision(request.header('if-match')),
      parsed.data,
    );
    if (!saved) throw new HttpError(409, 'LIST_CONFLICT', 'La lista fue modificada o eliminada desde otra sesión.');
    response.json({ list: payload(saved) });
  });

  router.delete('/:id', async (request, response) => {
    const deleted = await repository.delete(request.params.id, request.authenticatedUser!.id);
    if (!deleted) throw new HttpError(404, 'LIST_NOT_FOUND', 'No existe esa lista.');
    response.status(204).end();
  });

  return router;
}
