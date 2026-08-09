import { armyListSchema } from '@/catalog/schema';
import type { ArmyList } from '@/engine/types';

const STORAGE_PREFIX = 'sctmg-builder-draft:';

export type DraftScope = `account:${string}` | 'guest';

export interface StoredDraft {
  list: ArmyList;
  remoteRevision: number | null;
  isPublic: boolean;
}

function storageKey(scope: DraftScope): string {
  return `${STORAGE_PREFIX}${scope}`;
}

function storage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined'
      ? null
      : globalThis.localStorage;
  } catch {
    return null;
  }
}

export function loadDraft(scope: DraftScope): StoredDraft | null {
  const target = storage();
  if (!target) return null;

  try {
    const raw = target.getItem(storageKey(scope));
    if (!raw) return null;
    const decoded: unknown = JSON.parse(raw);
    if (typeof decoded === 'object' && decoded !== null && 'list' in decoded) {
      const record = decoded as {
        list?: unknown;
        remoteRevision?: unknown;
        isPublic?: unknown;
      };
      const parsed = armyListSchema.safeParse(record.list);
      if (!parsed.success) return null;
      return {
        list: parsed.data,
        remoteRevision: typeof record.remoteRevision === 'number' ? record.remoteRevision : null,
        isPublic: record.isPublic === true,
      };
    }

    // Compatibilidad con el formato inicial del borrador, que guardaba solo
    // la lista antes de añadir la revisión remota y la visibilidad.
    const parsed = armyListSchema.safeParse(decoded);
    return parsed.success
      ? { list: parsed.data, remoteRevision: null, isPublic: false }
      : null;
  } catch {
    return null;
  }
}

export function saveDraft(scope: DraftScope, draft: StoredDraft): void {
  const target = storage();
  if (!target) return;

  try {
    target.setItem(storageKey(scope), JSON.stringify(draft));
  } catch {
    // El almacenamiento puede estar lleno o bloqueado; la edición en memoria
    // debe seguir funcionando aunque no podamos crear la copia local.
  }
}

export function clearDraft(scope: DraftScope): void {
  const target = storage();
  if (!target) return;

  try {
    target.removeItem(storageKey(scope));
  } catch {
    // La limpieza es una mejora, no debe interrumpir una operación de lista.
  }
}
