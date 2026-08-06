import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { HttpError } from '../../lib/errors.js';
import { requireVerifiedUser } from '../../middleware/require-user.js';
import { ListRepository, type SavedListRecord } from './list.repository.js';
import { armyListPayloadSchema } from './list.schema.js';

function payload(record: SavedListRecord) {
  return {
    ...record.payload,
    revision: record.revision,
    remoteUpdatedAt: record.updatedAt,
    isPublic: record.isPublic,
    publishedAt: record.publishedAt,
    ownerNickname: record.ownerNickname,
    ownerAvatar: record.ownerAvatar,
    likeCount: record.likeCount,
    likedByCurrentUser: record.likedByCurrentUser,
  };
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

  router.get('/home', async (request, response) => {
    const [recentLists, publicLists] = await Promise.all([
      repository.listLatestForOwner(request.authenticatedUser!.id, 5),
      repository.listLatestPublic(request.authenticatedUser!.id, 10),
    ]);
    response.json({ recentLists: recentLists.map(payload), publicLists: publicLists.map(payload) });
  });

  router.get('/public', async (request, response) => {
    const lists = await repository.listPublic(request.authenticatedUser!.id);
    response.json({ lists: lists.map(payload) });
  });

  router.get('/public/:id', async (request, response) => {
    const list = await repository.findPublic(request.params.id, request.authenticatedUser!.id);
    if (!list) throw new HttpError(404, 'PUBLIC_LIST_NOT_FOUND', 'No existe esa lista pública.');
    response.json({ list: payload(list) });
  });

  router.post('/public/:id/like', async (request, response) => {
    const list = await repository.findPublic(request.params.id, request.authenticatedUser!.id);
    if (!list) throw new HttpError(404, 'PUBLIC_LIST_NOT_FOUND', 'No existe esa lista pública.');
    await repository.like(list.id, request.authenticatedUser!.id);
    const updated = await repository.findPublic(list.id, request.authenticatedUser!.id);
    response.json({ list: payload(updated!) });
  });

  router.delete('/public/:id/like', async (request, response) => {
    const list = await repository.findPublic(request.params.id, request.authenticatedUser!.id);
    if (!list) throw new HttpError(404, 'PUBLIC_LIST_NOT_FOUND', 'No existe esa lista pública.');
    await repository.unlike(list.id, request.authenticatedUser!.id);
    const updated = await repository.findPublic(list.id, request.authenticatedUser!.id);
    response.json({ list: payload(updated!) });
  });

  router.post('/public/:id/clone', async (request, response) => {
    const source = await repository.findPublic(request.params.id, request.authenticatedUser!.id);
    if (!source) throw new HttpError(404, 'PUBLIC_LIST_NOT_FOUND', 'No existe esa lista pública.');
    const now = new Date().toISOString();
    const cloned = armyListPayloadSchema.parse({
      ...source.payload,
      id: randomUUID(),
      name: `Copia de ${source.payload.name}`.slice(0, 160),
      createdAt: now,
      updatedAt: now,
    });
    const saved = await repository.create(request.authenticatedUser!.id, cloned);
    response.status(201).json({ list: payload(saved) });
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

  router.put('/:id/visibility', async (request, response) => {
    const parsed = z.object({ isPublic: z.boolean() }).safeParse(request.body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_VISIBILITY', 'La visibilidad indicada no es válida.');
    const saved = await repository.setPublic(request.params.id, request.authenticatedUser!.id, parsed.data.isPublic);
    if (!saved) throw new HttpError(404, 'LIST_NOT_FOUND', 'No existe esa lista.');
    response.json({ list: payload(saved) });
  });

  router.delete('/:id', async (request, response) => {
    const deleted = await repository.delete(request.params.id, request.authenticatedUser!.id);
    if (!deleted) throw new HttpError(404, 'LIST_NOT_FOUND', 'No existe esa lista.');
    response.status(204).end();
  });

  return router;
}
