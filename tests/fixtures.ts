import { buildCatalogIndex } from '@/engine/catalogIndex';
import type { CatalogIndex } from '@/engine/catalogIndex';
import type { ArmyList, ListEntry, Race } from '@/engine/types';
import { loadCatalog } from '@/catalog/loader';

export function indexFor(race: Race): CatalogIndex {
  return buildCatalogIndex(loadCatalog(race).catalog);
}

let counter = 0;
export function entry(
  unitEntryId: string,
  compositionId: string,
  upgrades: ListEntry['upgrades'] = [],
  reference = false,
): ListEntry {
  return {
    instanceId: `e${++counter}`,
    unitEntryId,
    compositionId,
    upgrades,
    reference,
  };
}

export function emptyList(overrides: Partial<ArmyList> = {}): ArmyList {
  return {
    id: 'test',
    name: 'Lista de prueba',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    catalogContentVersion: '2026.05.1.1',
    schemaVersion: '1.0.0',
    race: 'ZERG',
    scaleId: 'standard',
    mineralLimit: 2000,
    factionCardId: null,
    tacticalCardIds: [],
    creepCardId: null,
    entries: [],
    missionCardIds: [],
    deploymentCardIds: [],
    ...overrides,
  };
}

/**
 * La lista de ejemplo del reglamento (§9.1, "ARMY BUILDING EXAMPLE").
 *
 * Es el caso de regresión principal del proyecto: es el único punto donde una
 * fuente externa e independiente confirma que datos y reglas son correctos a
 * la vez. El manual publica los totales, así que si el motor no los reproduce
 * cifra por cifra, hay un error en el catálogo o en el motor.
 */
export function manualExampleList(): ArmyList {
  return emptyList({
    name: "Raynor's Raiders — ejemplo del manual §9.1",
    race: 'TERRAN',
    scaleId: 'standard',
    mineralLimit: 2000,
    factionCardId: 'terran.faction.raynors_raiders',
    tacticalCardIds: [
      'terran.tactical.barracks',
      'terran.tactical.barracks_proxy',
      'terran.tactical.factory',
      'terran.tactical.orbital_command',
      'terran.tactical.academy',
      'terran.tactical.engineering_bay',
    ],
    entries: [
      entry('terran.entry.marine', '9'),
      entry('terran.entry.marine', '9'),
      entry('terran.entry.marine', '6'),
      entry('terran.entry.marauder', '4'),
      entry('terran.entry.marauder', '2'),
      entry('terran.entry.jim_raynor', '1'),
      entry('terran.entry.medic', '3'),
      entry('terran.entry.medic', '3'),
      entry('terran.entry.goliath', '1'),
    ],
    missionCardIds: [
      'mission.gather_the_resources.standard',
      'mission.divide_and_conquer.standard',
    ],
    deploymentCardIds: ['deployment.gauntlet', 'deployment.typhoon'],
  });
}
