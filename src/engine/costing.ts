import type { CatalogIndex } from './catalogIndex';
import { findUpgrade } from './catalogIndex';
import type {
  ArmyList,
  Composition,
  CostSummary,
  EngagementScale,
  ListEntry,
  ResourceType,
  SlotLedger,
  SlotType,
  UnitEntry,
  UpgradeOption,
} from './types';
import { SLOT_TYPES } from './types';

/**
 * Presupuesto de gas vespeno: 10 % del límite de minerales (§9.1.4).
 * Se calcula desde el ratio de la escala, nunca desde una constante: si se
 * codificara "200" para Standard, Gran Ofensiva daría un valor incorrecto.
 */
export function vespeneLimitFor(
  scale: EngagementScale | undefined,
  mineralLimit: number,
): number {
  const ratio = scale?.vespeneRatio ?? 0.1;
  return Math.floor(mineralLimit * ratio);
}

export function findComposition(
  entry: UnitEntry,
  compositionId: string,
): Composition | undefined {
  return entry.compositions.find((c) => c.id === compositionId);
}

/** Coste de una mejora para una composición concreta (H3). */
export function upgradeCostFor(
  upgrade: UpgradeOption,
  compositionId: string,
): number | undefined {
  return upgrade.costByComposition[compositionId];
}

export function isUpgradeAvailableFor(
  upgrade: UpgradeOption,
  compositionId: string,
): boolean {
  return upgradeCostFor(upgrade, compositionId) !== undefined;
}

/** Minerales de una unidad de la lista: composición + mejoras aplicadas. */
export function entryMineralCost(
  index: CatalogIndex,
  listEntry: ListEntry,
): number {
  // Las invocadas no cuestan minerales (R10).
  if (listEntry.reference) return 0;

  const entry = index.unitEntries.get(listEntry.unitEntryId);
  if (!entry) return 0;
  if (entry.summoned) return 0;

  const composition = findComposition(entry, listEntry.compositionId);
  if (!composition) return 0;

  let total = composition.mineralCost;
  for (const applied of listEntry.upgrades) {
    const upgrade = findUpgrade(index, entry.id, applied.upgradeId);
    if (!upgrade) continue;
    total += upgradeCostFor(upgrade, listEntry.compositionId) ?? 0;
  }
  return total;
}

/** Espacios que ocupa una unidad de la lista. `null` si no ocupa ninguno. */
export function entrySlotUsage(
  index: CatalogIndex,
  listEntry: ListEntry,
): { slotType: SlotType; amount: number } | null {
  if (listEntry.reference) return null;

  const entry = index.unitEntries.get(listEntry.unitEntryId);
  if (!entry || entry.summoned) return null;

  const composition = findComposition(entry, listEntry.compositionId);
  if (!composition) return null;

  // R5: ocupa tantos espacios de su tipo como su valor de suministro.
  return { slotType: entry.slotType, amount: composition.supplyValue };
}

function emptyLedger(): SlotLedger {
  return { used: 0, total: 0, grantedBy: [], consumedBy: [] };
}

function emptySlots(): Record<SlotType, SlotLedger> {
  return {
    CORE: emptyLedger(),
    ELITE: emptyLedger(),
    SUPPORT: emptyLedger(),
    AIR: emptyLedger(),
    HERO: emptyLedger(),
  };
}

/**
 * Calcula minerales, gas, recurso por ronda, suministro y el libro mayor de
 * espacios. Función pura: la misma lista y el mismo catálogo dan el mismo
 * resultado siempre.
 */
export function computeCosts(list: ArmyList, index: CatalogIndex): CostSummary {
  const scale = index.catalog.scales.find((s) => s.id === list.scaleId);
  const slots = emptySlots();

  let mineralsSpent = 0;
  let vespeneSpent = 0;
  let resourcePerRound = 0;
  let totalSupply = 0;
  let resourceType: ResourceType | null = null;

  // --- Carta de facción: espacios iniciales y recurso base ---
  const faction = list.factionCardId
    ? index.factionCards.get(list.factionCardId)
    : undefined;

  if (faction) {
    resourceType = faction.resource;
    resourcePerRound += faction.resourcePerRound;
    for (const slotType of SLOT_TYPES) {
      const granted = faction.startingSlots[slotType] ?? 0;
      if (granted > 0) {
        slots[slotType].total += granted;
        slots[slotType].grantedBy.push({
          cardId: faction.id,
          cardName: faction.name,
          amount: granted,
        });
      }
    }
  }

  // --- Cartas tácticas: gas, espacios desbloqueados y recurso ---
  for (const cardId of list.tacticalCardIds) {
    const card = index.tacticalCards.get(cardId);
    if (!card) continue;

    vespeneSpent += card.vespeneCost;
    resourcePerRound += card.resourcePerRound;
    if (!resourceType && card.resource) resourceType = card.resource;

    for (const slotType of SLOT_TYPES) {
      const granted = card.slotsGranted[slotType] ?? 0;
      if (granted > 0) {
        slots[slotType].total += granted;
        slots[slotType].grantedBy.push({
          cardId: card.id,
          cardName: card.name,
          amount: granted,
        });
      }
    }
  }

  // --- Creep Card: cuesta gas, no otorga espacios ---
  if (list.creepCardId) {
    const creep = index.creepCards.get(list.creepCardId);
    if (creep) vespeneSpent += creep.vespeneCost;
  }

  // --- Unidades: minerales, espacios consumidos y suministro ---
  for (const listEntry of list.entries) {
    mineralsSpent += entryMineralCost(index, listEntry);

    const usage = entrySlotUsage(index, listEntry);
    if (usage) {
      const entry = index.unitEntries.get(listEntry.unitEntryId);
      slots[usage.slotType].used += usage.amount;
      slots[usage.slotType].consumedBy.push({
        instanceId: listEntry.instanceId,
        unitName: entry?.name ?? listEntry.unitEntryId,
        amount: usage.amount,
      });
      totalSupply += usage.amount;
    }
  }

  return {
    mineralsSpent,
    mineralLimit: list.mineralLimit,
    vespeneSpent,
    vespeneLimit: vespeneLimitFor(scale, list.mineralLimit),
    resourceType,
    resourcePerRound,
    totalSupply,
    slots,
  };
}
