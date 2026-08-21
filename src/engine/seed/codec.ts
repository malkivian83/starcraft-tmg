import { deflateSync, inflateSync } from 'fflate';
import type { CatalogIndex } from '../catalogIndex';
import type { ArmyList, ListEntry, Race, ScaleId } from '../types';
import { decodeBase32, encodeBase32, groupSeed } from './base32';
import {
  ByteReader,
  ByteWriter,
  checksum16,
  versionFingerprint,
} from './varint';

/**
 * Códec de seed (SDD §7.1).
 *
 * El seed CONTIENE la lista, no la referencia: no hay servidor, así que un
 * identificador remoto no funcionaría sin conexión ni sobreviviría al proyecto.
 *
 * Guarda números (`seedId`), no cadenas, porque es lo que lo mantiene corto.
 * Eso obliga a que cada `seedId` sea permanente: si se derivaran del orden del
 * fichero JSON, añadir una unidad desplazaría los índices y todos los seeds
 * compartidos hasta entonces decodificarían unidades equivocadas SIN dar error.
 * La prueba de integridad del catálogo vigila esa unicidad.
 */

const FORMAT_VERSION = 1;
const PREFIX = 'SCT1';

const RACES: Race[] = ['ZERG', 'TERRAN', 'PROTOSS'];
const SCALES: ScaleId[] = ['skirmish', 'standard', 'grand_offensive'];

export type SeedStatus = 'ok' | 'version_mismatch' | 'partial' | 'corrupt';

export interface SeedDecodeResult {
  list: ArmyList | null;
  status: SeedStatus;
  /** Descripción de los elementos que el catálogo actual ya no reconoce. */
  missing: string[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Codificación
// ---------------------------------------------------------------------------

export function encodeSeed(list: ArmyList, index: CatalogIndex): string {
  const w = new ByteWriter();

  w.writeByte(FORMAT_VERSION);
  w.writeVarint(versionFingerprint(index.catalog.contentVersion));
  w.writeByte(Math.max(0, RACES.indexOf(list.race)));
  w.writeByte(Math.max(0, SCALES.indexOf(list.scaleId)));
  w.writeVarint(list.mineralLimit);

  w.writeVarint(seedIdOf(index, 'faction', list.factionCardId));
  w.writeVarint(seedIdOf(index, 'creep', list.creepCardId));

  writeIds(w, list.tacticalCardIds, (id) => seedIdOf(index, 'tactical', id));
  writeIds(w, list.missionCardIds, (id) => seedIdOf(index, 'mission', id));
  writeIds(w, list.deploymentCardIds, (id) =>
    seedIdOf(index, 'deployment', id),
  );

  w.writeVarint(list.entries.length);
  for (const entry of list.entries) {
    const unit = index.unitEntries.get(entry.unitEntryId);
    w.writeVarint(unit?.seedId ?? 0);

    // La composición se identifica por su NÚMERO DE MODELOS, no por su
    // posición: el número de modelos es un dato del juego y no cambia de sitio
    // si alguien reordena el JSON.
    const composition = unit?.compositions.find(
      (c) => c.id === entry.compositionId,
    );
    w.writeVarint(composition?.models ?? 0);

    w.writeByte(entry.reference ? 1 : 0);

    w.writeVarint(entry.upgrades.length);
    for (const applied of entry.upgrades) {
      const upgrade = unit?.upgrades.find((u) => u.id === applied.upgradeId);
      w.writeVarint(upgrade?.seedId ?? 0);
      // modelIndex + 1, reservando el 0 para "sin nominar" (mejora estándar).
      w.writeVarint(applied.modelIndex === null ? 0 : applied.modelIndex + 1);
    }
  }

  const payload = w.toBytes();
  const withChecksum = new Uint8Array(payload.length + 2);
  withChecksum.set(payload, 0);
  const sum = checksum16(payload);
  withChecksum[payload.length] = (sum >> 8) & 255;
  withChecksum[payload.length + 1] = sum & 255;

  return groupSeed(encodeBase32(frame(withChecksum)), PREFIX);
}

const MODE_RAW = 0;
const MODE_DEFLATE = 1;

/**
 * Comprime si merece la pena. En listas pequeñas la cabecera de deflate pesa
 * más que lo que ahorra, así que se guarda el modo elegido en el primer byte
 * y se usa el resultado más corto de los dos.
 */
function frame(data: Uint8Array): Uint8Array {
  const deflated = deflateSync(data, { level: 9 });
  const useDeflate = deflated.length < data.length;
  const body = useDeflate ? deflated : data;

  const out = new Uint8Array(body.length + 1);
  out[0] = useDeflate ? MODE_DEFLATE : MODE_RAW;
  out.set(body, 1);
  return out;
}

function unframe(framed: Uint8Array): Uint8Array {
  const mode = framed[0];
  const body = framed.subarray(1);
  if (mode === MODE_RAW) return body;
  if (mode === MODE_DEFLATE) return inflateSync(body);
  throw new Error('Modo de compresión desconocido en el seed.');
}

// ---------------------------------------------------------------------------
// Decodificación
// ---------------------------------------------------------------------------

export function decodeSeed(
  seed: string,
  index: CatalogIndex,
): SeedDecodeResult {
  const missing: string[] = [];
  let bytes: Uint8Array;

  try {
    bytes = unframe(decodeBase32(stripPrefix(seed)));
  } catch {
    // Un fallo al descomprimir es, por definición, un seed corrupto.
    return {
      list: null,
      status: 'corrupt',
      missing,
      error:
        'El seed está incompleto o alterado. Cópialo de nuevo entero, sin espacios de más.',
    };
  }

  if (bytes.length < 4) {
    return { list: null, status: 'corrupt', missing, error: 'Seed demasiado corto.' };
  }

  // El checksum se comprueba ANTES de interpretar nada: un seed pegado a
  // medias debe rechazarse, no producir una lista plausible pero falsa.
  const payload = bytes.subarray(0, bytes.length - 2);
  const expected =
    ((bytes[bytes.length - 2] as number) << 8) |
    (bytes[bytes.length - 1] as number);
  if (checksum16(payload) !== expected) {
    return {
      list: null,
      status: 'corrupt',
      missing,
      error:
        'El seed está incompleto o alterado. Cópialo de nuevo entero, sin espacios de más.',
    };
  }

  try {
    const r = new ByteReader(payload);

    const format = r.readByte();
    if (format !== FORMAT_VERSION) {
      return {
        list: null,
        status: 'corrupt',
        missing,
        error: `Formato de seed no soportado (versión ${format}).`,
      };
    }

    const fingerprint = r.readVarint();
    const sameVersion =
      fingerprint === versionFingerprint(index.catalog.contentVersion);

    const race = RACES[r.readByte()] ?? 'ZERG';
    const scaleId = SCALES[r.readByte()] ?? 'standard';
    const mineralLimit = r.readVarint();

    const factionCardId = lookup(index, 'faction', r.readVarint(), missing);
    const creepCardId = lookup(index, 'creep', r.readVarint(), missing);

    const tacticalCardIds = readIds(r, (s) =>
      lookup(index, 'tactical', s, missing),
    );
    const missionCardIds = readIds(r, (s) =>
      lookup(index, 'mission', s, missing),
    );
    const deploymentCardIds = readIds(r, (s) =>
      lookup(index, 'deployment', s, missing),
    );

    const entryCount = r.readVarint();
    const entries: ListEntry[] = [];
    for (let i = 0; i < entryCount; i++) {
      const unitSeed = r.readVarint();
      const models = r.readVarint();
      const reference = r.readByte() === 1;
      const upgradeCount = r.readVarint();

      const unit = index.catalog.unitEntries.find((e) => e.seedId === unitSeed);
      const composition = unit?.compositions.find((c) => c.models === models);

      const upgrades: ListEntry['upgrades'] = [];
      for (let u = 0; u < upgradeCount; u++) {
        const upgradeSeed = r.readVarint();
        const rawModelIndex = r.readVarint();
        const upgrade = unit?.upgrades.find((x) => x.seedId === upgradeSeed);
        if (!upgrade) {
          if (unit) missing.push(`mejora #${upgradeSeed} de ${unit.name}`);
          continue;
        }
        upgrades.push({
          upgradeId: upgrade.id,
          modelIndex: rawModelIndex === 0 ? null : rawModelIndex - 1,
        });
      }

      if (!unit || !composition) {
        missing.push(`unidad #${unitSeed} (${models} miniaturas)`);
        continue;
      }

      entries.push({
        instanceId: `seed-${i}`,
        unitEntryId: unit.id,
        compositionId: composition.id,
        upgrades,
        reference,
      });
    }

    if (!r.exhausted) {
      return {
        list: null,
        status: 'corrupt',
        missing,
        error: 'El seed contiene datos sobrantes.',
      };
    }

    const now = new Date().toISOString();
    const list: ArmyList = {
      id: crypto.randomUUID(),
      name: 'Lista importada',
      createdAt: now,
      updatedAt: now,
      catalogContentVersion: index.catalog.contentVersion,
      schemaVersion: index.catalog.schemaVersion,
      race,
      scaleId,
      mineralLimit,
      factionCardId,
      tacticalCardIds,
      creepCardId,
      entries,
      missionCardIds,
      deploymentCardIds,
    };

    const status: SeedStatus =
      missing.length > 0 ? 'partial' : sameVersion ? 'ok' : 'version_mismatch';

    return { list, status, missing };
  } catch (error) {
    return corrupt(error);
  }
}

// ---------------------------------------------------------------------------

type Kind = 'faction' | 'tactical' | 'creep' | 'mission' | 'deployment';

function collectionFor(index: CatalogIndex, kind: Kind) {
  switch (kind) {
    case 'faction':
      return index.catalog.factionCards;
    case 'tactical':
      return index.catalog.tacticalCards;
    case 'creep':
      return index.catalog.creepCards;
    case 'mission':
      return index.catalog.missionCards;
    case 'deployment':
      return index.catalog.deploymentCards;
  }
}

function seedIdOf(
  index: CatalogIndex,
  kind: Kind,
  id: string | null,
): number {
  if (!id) return 0;
  return collectionFor(index, kind).find((c) => c.id === id)?.seedId ?? 0;
}

function lookup(
  index: CatalogIndex,
  kind: Kind,
  seedId: number,
  missing: string[],
): string | null {
  if (seedId === 0) return null;
  const found = collectionFor(index, kind).find((c) => c.seedId === seedId);
  if (!found) {
    missing.push(`${kind} #${seedId}`);
    return null;
  }
  return found.id;
}

function writeIds(
  w: ByteWriter,
  ids: string[],
  toSeed: (id: string) => number,
): void {
  w.writeVarint(ids.length);
  for (const id of ids) w.writeVarint(toSeed(id));
}

function readIds(
  r: ByteReader,
  fromSeed: (seedId: number) => string | null,
): string[] {
  const count = r.readVarint();
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const id = fromSeed(r.readVarint());
    if (id) out.push(id);
  }
  return out;
}

function stripPrefix(seed: string): string {
  const trimmed = seed.trim();
  const withoutPrefix = trimmed.replace(
    new RegExp(`^${PREFIX}[-\\s]*`, 'i'),
    '',
  );
  if (withoutPrefix.length === 0) throw new Error('Seed vacío.');
  return withoutPrefix;
}

function corrupt(error: unknown): SeedDecodeResult {
  return {
    list: null,
    status: 'corrupt',
    missing: [],
    error: error instanceof Error ? error.message : 'Seed no válido.',
  };
}
