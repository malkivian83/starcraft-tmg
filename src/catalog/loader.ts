import type { Catalog, Race } from '@/engine/types';
import coreData from './data/core.json';
import scenarioData from './data/scenarios.json';
import terranData from './data/terran.json';
import zergData from './data/zerg.json';
import {
  coreCatalogSchema,
  raceCatalogSchema,
  scenarioCatalogSchema,
} from './schema';

const RACE_DATA: Record<Race, unknown> = {
  ZERG: zergData,
  TERRAN: terranData,
  // Protoss llega en la siguiente iteración; el catálogo lo admite sin cambios.
  PROTOSS: null,
};

export interface CatalogLoadResult {
  catalog: Catalog;
  problems: string[];
}

/**
 * Carga y valida el catálogo de una raza junto con las escalas y escenarios.
 *
 * Los escenarios son comunes a las tres razas (hallazgo M1), así que se cargan
 * siempre; no dependen de la raza elegida.
 */
export function loadCatalog(race: Race): CatalogLoadResult {
  const problems: string[] = [];

  const core = coreCatalogSchema.parse(coreData);
  const scenarios = scenarioCatalogSchema.parse(scenarioData);

  const raw = RACE_DATA[race];
  if (!raw) {
    throw new Error(
      `El catálogo de ${race} todavía no está disponible en esta versión.`,
    );
  }
  const raceCatalog = raceCatalogSchema.parse(raw);

  if (raceCatalog.contentVersion !== core.contentVersion) {
    problems.push(
      `La versión de contenido de ${race} (${raceCatalog.contentVersion}) no coincide con la del núcleo (${core.contentVersion}).`,
    );
  }

  const catalog: Catalog = {
    schemaVersion: core.schemaVersion,
    contentVersion: core.contentVersion,
    sourceRef: raceCatalog.sourceRef,
    scales: core.scales,
    factionCards: raceCatalog.factionCards,
    tacticalCards: raceCatalog.tacticalCards,
    creepCards: raceCatalog.creepCards,
    unitCards: raceCatalog.unitCards,
    unitEntries: raceCatalog.unitEntries,
    missionCards: scenarios.missionCards,
    deploymentCards: scenarios.deploymentCards,
  };

  return { catalog, problems };
}

export function availableRaces(): Race[] {
  return (Object.keys(RACE_DATA) as Race[]).filter((r) => RACE_DATA[r] !== null);
}
