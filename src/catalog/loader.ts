import type { Catalog, Race } from '@/engine/types';
import coreData from './data/core.json';
import protossData from './data/protoss.json';
import scenarioData from './data/scenarios.json';
import terranData from './data/terran.json';
import zergData from './data/zerg.json';
import {
  coreCatalogSchema,
  raceCatalogSchema,
  scenarioCatalogSchema,
  type RaceCatalogData,
} from './schema';

const RACE_DATA: Record<Race, unknown> = {
  ZERG: zergData,
  TERRAN: terranData,
  PROTOSS: protossData,
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
  const raceCatalog = withMiniRefs(
    applyUpgradeGlossary(raceCatalogSchema.parse(raw)),
  );

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

/**
 * Deriva la ruta de la foto de miniatura a partir del id de la carta.
 *
 * `tools/extract/makeMinis.mjs` las escribe siempre como
 * `public/cards/<raza>/mini-<slug>.jpg`, así que repetir la ruta en cada una
 * de las 18 cartas del JSON solo añadiría sitios donde desincronizarse.
 * Si el fichero no existe, la interfaz oculta la imagen.
 */
function withMiniRefs(catalog: RaceCatalogData): RaceCatalogData {
  const race = catalog.race.toLowerCase();
  return {
    ...catalog,
    unitCards: catalog.unitCards.map((card) => ({
      ...card,
      miniRef: card.miniRef ?? `cards/${race}/mini-${card.id.split('.').pop()}.jpg`,
    })),
  };
}

/**
 * Rellena cada mejora con el texto y el arma del glosario de su raza.
 *
 * Solo se aplica a las mejoras que no traen ya sus propias habilidades: así
 * una mejora concreta puede seguir definiendo un texto propio si difiere.
 */
function applyUpgradeGlossary(catalog: RaceCatalogData): RaceCatalogData {
  const glossary = catalog.upgradeGlossary;
  if (!glossary) return catalog;

  return {
    ...catalog,
    unitEntries: catalog.unitEntries.map((entry) => ({
      ...entry,
      upgrades: entry.upgrades.map((upgrade) => {
        const shared = glossary[upgrade.id];
        if (!shared) return upgrade;

        const alreadyDescribed =
          upgrade.grantsAbilities.length > 0 || Boolean(upgrade.text);

        return {
          ...upgrade,
          text: upgrade.text ?? shared.text,
          grantsAbilities: alreadyDescribed
            ? upgrade.grantsAbilities
            : [
                {
                  name: upgrade.name,
                  phase: shared.phase,
                  type: shared.type,
                  cost: shared.cost,
                  text: shared.text,
                  fromUpgrade: true,
                },
              ],
          grantsWeapons:
            upgrade.grantsWeapons.length > 0
              ? upgrade.grantsWeapons
              : shared.weapon
                ? [shared.weapon]
                : [],
        };
      }),
    })),
  };
}

export function availableRaces(): Race[] {
  return (Object.keys(RACE_DATA) as Race[]).filter((r) => RACE_DATA[r] !== null);
}
