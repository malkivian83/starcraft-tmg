import type {
  Catalog,
  CreepCard,
  DeploymentCard,
  FactionCard,
  MissionCard,
  TacticalCard,
  UnitCard,
  UnitEntry,
  UpgradeOption,
} from './types';

/**
 * Índice de acceso por id. Se construye una vez y se reutiliza: sin él, cada
 * regla haría búsquedas lineales sobre el catálogo y la validación completa
 * pasaría de O(n) a O(n²).
 */
export interface CatalogIndex {
  catalog: Catalog;
  factionCards: Map<string, FactionCard>;
  tacticalCards: Map<string, TacticalCard>;
  creepCards: Map<string, CreepCard>;
  unitCards: Map<string, UnitCard>;
  unitEntries: Map<string, UnitEntry>;
  missionCards: Map<string, MissionCard>;
  deploymentCards: Map<string, DeploymentCard>;
  /** upgradeId -> { entrada propietaria, mejora } */
  upgrades: Map<string, { entry: UnitEntry; upgrade: UpgradeOption }>;
}

function byId<T extends { id: string }>(items: readonly T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return map;
}

export function buildCatalogIndex(catalog: Catalog): CatalogIndex {
  const upgrades = new Map<
    string,
    { entry: UnitEntry; upgrade: UpgradeOption }
  >();
  for (const entry of catalog.unitEntries) {
    for (const upgrade of entry.upgrades) {
      // Las mejoras se indexan con la entrada que las posee: el mismo nombre
      // ("Burrow Ambush") existe en varias unidades con costes distintos.
      upgrades.set(`${entry.id}::${upgrade.id}`, { entry, upgrade });
    }
  }

  return {
    catalog,
    factionCards: byId(catalog.factionCards),
    tacticalCards: byId(catalog.tacticalCards),
    creepCards: byId(catalog.creepCards),
    unitCards: byId(catalog.unitCards),
    unitEntries: byId(catalog.unitEntries),
    missionCards: byId(catalog.missionCards),
    deploymentCards: byId(catalog.deploymentCards),
    upgrades,
  };
}

export function findUpgrade(
  index: CatalogIndex,
  entryId: string,
  upgradeId: string,
): UpgradeOption | undefined {
  return index.upgrades.get(`${entryId}::${upgradeId}`)?.upgrade;
}
