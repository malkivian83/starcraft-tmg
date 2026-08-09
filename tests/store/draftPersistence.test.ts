import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEmptyList } from '@/store/listStore';
import { clearDraft, loadDraft, saveDraft } from '@/store/draftPersistence';

describe('borrador local de listas de cuenta', () => {
  const values = new Map<string, string>();
  const localStorageMock = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } as Storage;

  beforeEach(() => {
    values.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: localStorageMock,
    });
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('guarda y recupera una lista por cuenta', () => {
    const list = createEmptyList('TERRAN');
    list.name = 'Borrador de prueba';

    saveDraft('account:user-1', { list, remoteRevision: 7, isPublic: true });

    expect(loadDraft('account:user-1')).toEqual({ list, remoteRevision: 7, isPublic: true });
    expect(loadDraft('account:user-2')).toBeNull();
  });

  it('guarda y recupera el borrador de invitado en el dispositivo', () => {
    const list = createEmptyList('ZERG');
    list.name = 'Borrador invitado';

    saveDraft('guest', { list, remoteRevision: null, isPublic: false });

    expect(loadDraft('guest')).toEqual({ list, remoteRevision: null, isPublic: false });
  });

  it('permite borrar el borrador después de guardar la lista', () => {
    saveDraft('account:user-1', { list: createEmptyList(), remoteRevision: null, isPublic: false });
    clearDraft('account:user-1');

    expect(loadDraft('account:user-1')).toBeNull();
  });
});
