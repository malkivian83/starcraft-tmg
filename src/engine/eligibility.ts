import type { CatalogIndex } from './catalogIndex';
import { computeCosts, isUpgradeAvailableFor } from './costing';
import { missingTags, tagsAreEligible } from './tags';
import type {
  ArmyList,
  CostSummary,
  Eligibility,
  EligibleCreepCard,
  EligibleTacticalCard,
  EligibleUnit,
  Localized,
  SlotType,
  UnitEntry,
  UpgradeOption,
} from './types';

const SLOT_LABEL: Record<SlotType, string> = {
  CORE: 'Núcleo',
  ELITE: 'Élite',
  SUPPORT: 'Apoyo',
  AIR: 'Aéreo',
  HERO: 'Héroe',
};

const t = (es: string, en: string): Localized => ({ es, en });

const AVAILABLE: Eligibility = { status: 'available' };

/**
 * Clasificación en dos niveles (SDD §6.6):
 *
 *   impossible → nunca podrá formar parte de este ejército. La interfaz LO OCULTA.
 *   blocked    → legal, pero el estado actual impide añadirlo. SE MUESTRA atenuado.
 *   available  → se puede añadir.
 *
 * El motor solo clasifica. Mostrar u ocultar es decisión de la interfaz, así
 * que cambiar el criterio no obliga a tocar el motor ni sus pruebas.
 */
export function getEligibleUnits(
  list: ArmyList,
  index: CatalogIndex,
  summary?: CostSummary,
): EligibleUnit[] {
  const costs = summary ?? computeCosts(list, index);
  const faction = list.factionCardId
    ? index.factionCards.get(list.factionCardId)
    : undefined;

  const alreadyIncluded = new Set(
    list.entries.filter((e) => !e.reference).map((e) => e.unitEntryId),
  );

  return index.catalog.unitEntries
    .filter((entry) => !faction || entry.race === faction.race)
    .map((entry) => classifyUnit(entry, faction, alreadyIncluded, costs, list));
}

function classifyUnit(
  entry: UnitEntry,
  faction: ReturnType<CatalogIndex['factionCards']['get']>,
  alreadyIncluded: Set<string>,
  costs: CostSummary,
  list: ArmyList,
): EligibleUnit {
  // --- Nivel 1: imposible ---------------------------------------------------
  if (faction && !tagsAreEligible(entry.tags, faction.tags)) {
    const missing = missingTags(entry.tags, faction.tags).join(', ');
    return {
      entry,
      status: 'impossible',
      reason: t(
        `Requiere la etiqueta ${missing}, que no tiene ${faction.name}.`,
        `Requires tag ${missing}.`,
      ),
      compositions: entry.compositions.map((composition) => ({
        composition,
        status: 'impossible',
      })),
    };
  }

  if (entry.unique && alreadyIncluded.has(entry.id)) {
    return {
      entry,
      status: 'impossible',
      reason: t(
        'Es UNIQUE y ya está incluida en la lista.',
        'UNIQUE and already included.',
      ),
      compositions: entry.compositions.map((composition) => ({
        composition,
        status: 'impossible',
      })),
    };
  }

  // Las invocadas nunca se reclutan; se ofrecen aparte como referencia.
  if (entry.summoned) {
    return {
      entry,
      status: 'available',
      reason: t(
        'Unidad invocada: se añade solo como referencia, sin coste ni espacios.',
        'Summoned Unit: reference only.',
      ),
      compositions: entry.compositions.map((composition) => ({
        composition,
        status: 'available',
      })),
    };
  }

  // --- Nivel 2: bloqueado por recursos --------------------------------------
  const mineralsLeft = costs.mineralLimit - costs.mineralsSpent;
  const ledger = costs.slots[entry.slotType];
  const slotsLeft = ledger.total - ledger.used;
  const slotLabel = SLOT_LABEL[entry.slotType];

  const compositions = entry.compositions.map((composition) => {
    if (composition.supplyValue > slotsLeft) {
      const needed = composition.supplyValue;
      return {
        composition,
        status: 'blocked' as const,
        reason: t(
          `Ocupa ${needed} ${needed === 1 ? 'espacio' : 'espacios'} de ${slotLabel} y te ${slotsLeft === 1 ? 'queda' : 'quedan'} ${slotsLeft}.`,
          `Needs ${needed} ${slotLabel} slots, ${slotsLeft} free.`,
        ),
        remedy: t(
          `Compra una Carta Táctica que otorgue espacios de ${slotLabel}.`,
          `Buy a Tactical Card granting ${slotLabel} slots.`,
        ),
      };
    }
    if (composition.mineralCost > mineralsLeft) {
      return {
        composition,
        status: 'blocked' as const,
        reason: t(
          `Cuesta ${composition.mineralCost} minerales y te quedan ${mineralsLeft}.`,
          `Costs ${composition.mineralCost}, ${mineralsLeft} left.`,
        ),
        remedy: t(
          'Libera minerales quitando otra unidad o una mejora.',
          'Free up Minerals.',
        ),
      };
    }
    return { composition, status: 'available' as const };
  });

  const anyAvailable = compositions.some((c) => c.status === 'available');
  if (anyAvailable) {
    return { entry, ...AVAILABLE, compositions };
  }

  // Ninguna composición cabe: la unidad se muestra atenuada con el motivo de
  // la opción más barata, que es la que menos lejos está de poder añadirse.
  const cheapest = compositions.reduce((best, current) =>
    current.composition.mineralCost < best.composition.mineralCost
      ? current
      : best,
  );

  const blocked: EligibleUnit = {
    entry,
    status: 'blocked',
    compositions,
  };
  if (cheapest.status === 'blocked') {
    if (cheapest.reason) blocked.reason = cheapest.reason;
    if (cheapest.remedy) blocked.remedy = cheapest.remedy;
  }
  // Sin carta de facción todavía no hay presupuesto que evaluar.
  if (!list.factionCardId) return { entry, ...AVAILABLE, compositions };
  return blocked;
}

export function getEligibleTacticalCards(
  list: ArmyList,
  index: CatalogIndex,
  summary?: CostSummary,
): EligibleTacticalCard[] {
  const costs = summary ?? computeCosts(list, index);
  const faction = list.factionCardId
    ? index.factionCards.get(list.factionCardId)
    : undefined;
  const vespeneLeft = costs.vespeneLimit - costs.vespeneSpent;

  return index.catalog.tacticalCards
    .filter((card) => !faction || card.race === faction.race)
    .map((card): EligibleTacticalCard => {
      if (faction && !tagsAreEligible(card.tags, faction.tags)) {
        const missing = missingTags(card.tags, faction.tags).join(', ');
        return {
          card,
          status: 'impossible',
          reason: t(
            `Requiere la etiqueta ${missing}, que no tiene ${faction.name}.`,
            `Requires tag ${missing}.`,
          ),
        };
      }
      if (card.unique && list.tacticalCardIds.includes(card.id)) {
        return {
          card,
          status: 'impossible',
          reason: t('Es UNIQUE y ya está incluida.', 'UNIQUE and already included.'),
        };
      }
      if (card.vespeneCost > vespeneLeft) {
        return {
          card,
          status: 'blocked',
          reason: t(
            `Cuesta ${card.vespeneCost} de gas y te quedan ${vespeneLeft}.`,
            `Costs ${card.vespeneCost} gas, ${vespeneLeft} left.`,
          ),
          remedy: t(
            'Quita otra Carta Táctica para liberar gas.',
            'Remove another Tactical Card.',
          ),
        };
      }
      return { card, ...AVAILABLE };
    });
}

export function getEligibleCreepCards(
  list: ArmyList,
  index: CatalogIndex,
  summary?: CostSummary,
): EligibleCreepCard[] {
  const costs = summary ?? computeCosts(list, index);
  const faction = list.factionCardId
    ? index.factionCards.get(list.factionCardId)
    : undefined;
  if (faction && faction.race !== 'ZERG') return [];

  // La creep card ya elegida no consume presupuesto para la comparación:
  // seleccionar otra la sustituye, no la suma.
  const currentCost = list.creepCardId
    ? (index.creepCards.get(list.creepCardId)?.vespeneCost ?? 0)
    : 0;
  const vespeneLeft = costs.vespeneLimit - costs.vespeneSpent + currentCost;

  return index.catalog.creepCards
    .filter((card) => !faction || tagsAreEligible(card.tags, faction.tags))
    .map((card): EligibleCreepCard => {
      if (card.vespeneCost > vespeneLeft) {
        return {
          card,
          status: 'blocked',
          reason: t(
            `Cuesta ${card.vespeneCost} de gas y te quedan ${vespeneLeft}.`,
            `Costs ${card.vespeneCost} gas, ${vespeneLeft} left.`,
          ),
          remedy: t(
            'Libera gas quitando una Carta Táctica.',
            'Remove a Tactical Card to free gas.',
          ),
        };
      }
      return { card, ...AVAILABLE };
    });
}

/** Mejoras aplicables a una unidad ya incluida, con su coste real. */
export function getEligibleUpgrades(
  entry: UnitEntry,
  compositionId: string,
): Array<{ upgrade: UpgradeOption; cost: number }> {
  return entry.upgrades
    .filter((upgrade) => isUpgradeAvailableFor(upgrade, compositionId))
    .map((upgrade) => ({
      upgrade,
      cost: upgrade.costByComposition[compositionId] as number,
    }));
}
