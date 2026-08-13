import { openDB, type IDBPDatabase } from 'idb';
import { armyListSchema } from '@/catalog/schema';
import type { ArmyList } from '@/engine/types';
import type { SupportedLocale } from '@/i18n/types';

const DB_NAME = 'sctmg-army-builder';
const DB_VERSION = 1;
const STORE_LISTS = 'lists';

let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains(STORE_LISTS)) {
        database.createObjectStore(STORE_LISTS, { keyPath: 'id' });
      }
    },
  });
  return dbPromise;
}

export async function saveList(list: ArmyList): Promise<void> {
  await (await db()).put(STORE_LISTS, list);
}

export async function deleteList(id: string): Promise<void> {
  await (await db()).delete(STORE_LISTS, id);
}

export async function loadLists(): Promise<ArmyList[]> {
  const all = (await (await db()).getAll(STORE_LISTS)) as unknown[];
  // Se descarta en silencio lo que no valide: un registro corrupto no debe
  // impedir abrir el resto de listas guardadas.
  return all
    .map((raw) => armyListSchema.safeParse(raw))
    .filter((r) => r.success)
    .map((r) => (r as { data: ArmyList }).data);
}

export interface ImportResult {
  list: ArmyList | null;
  error?: string;
}

/** Importa desde JSON explicando qué falla, en lugar de un error genérico. */
export function importListFromJson(text: string, locale: SupportedLocale = 'es'): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { list: null, error: locale === 'en' ? 'The file does not contain valid JSON.' : 'El fichero no contiene JSON válido.' };
  }

  const parsed = armyListSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return {
      list: null,
      error: first
        ? locale === 'en'
          ? `The file does not have the expected format: ${first.path.join('.')} — ${first.message}`
          : `El fichero no tiene el formato esperado: ${first.path.join('.')} — ${first.message}`
        : locale === 'en' ? 'The file does not have the expected format.' : 'El fichero no tiene el formato esperado.',
    };
  }
  return { list: parsed.data };
}

export function exportListToJson(list: ArmyList): string {
  return JSON.stringify(list, null, 2);
}

export function downloadJson(list: ArmyList): void {
  const blob = new Blob([exportListToJson(list)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${slugify(list.name)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function slugify(name: string): string {
  return (
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'lista'
  );
}
