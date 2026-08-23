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
  FactionCard,
  RecruitmentResult,
  SlotType,
  UnitEntry,
  UnitCompositionEligibility,
  UnitEligibilityStatus,
  UpgradeOption,
} from './types';

const SLOT_LABEL: Record<SlotType, string> = {
  CORE: 'Core',
  ELITE: 'Élite',
  SUPPORT: 'Apoyo',
  AIR: 'Aéreo',
  HERO: 'Héroe',
};

const t = (es: string, en: string): Localized => ({ es, en });

const AVAILABLE: Eligibility = { status: 'available' };

export function isUnitAddable(status: UnitEligibilityStatus): boolean {
  return status === 'available' || status === 'provisional';
}

/**
 * Clasificación de unidades (SDD §6.6):
 *
 *   impossible  → una restricción dura impide incorporarla.
 *   blocked     → los minerales impiden incorporarla ahora.
 *   provisional → se puede incorporar, pero la lista quedará con déficit de espacios.
 *   available   → se puede incorporar sin crear déficit.
 *
 * El motor solo clasifica; la UI decide cómo atenuar y explicar cada estado.
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

  // El catálogo de reclutamiento solo tiene sentido después de resolver una
  // Carta de Facción válida. La validación final sigue mostrando R0 para una
  // lista importada o manipulada sin ella.
  if (!faction || faction.race !== list.race) return [];

  const alreadyIncluded = new Set(
    list.entries.filter((e) => !e.reference).map((e) => e.unitEntryId),
  );

  return index.catalog.unitEntries
    .filter((entry) => entry.race === faction.race)
    .map((entry) => classifyUnit(entry, faction, alreadyIncluded, costs));
}

function classifyUnit(
  entry: UnitEntry,
  faction: FactionCard,
  alreadyIncluded: Set<string>,
  costs: CostSummary,
): EligibleUnit {
  // --- Restricciones duras de unidad ---------------------------------------
  if (entry.race !== faction.race) {
    const reason = t(
      `Esta unidad pertenece a ${entry.race} y no puede formar parte de una lista ${faction.race}.`,
      `This unit belongs to ${entry.race} and cannot join a ${faction.race} list.`,
    );
    return {
      entry,
      status: 'impossible',
      constraint: 'RACE_MISMATCH',
      reason,
      compositions: entry.compositions.map((composition) => ({
        composition,
        status: 'impossible' as const,
        constraint: 'RACE_MISMATCH' as const,
        reason,
      })),
    };
  }

  if (!tagsAreEligible(entry.tags, faction.tags)) {
    const missing = missingTags(entry.tags, faction.tags).join(', ');
    const reason = t(
      `Requiere la etiqueta ${missing}, que no tiene ${faction.name}.`,
      `Requires tag ${missing}.`,
    );
    return {
      entry,
      status: 'impossible',
      constraint: 'TAG_MISMATCH',
      reason,
      compositions: entry.compositions.map((composition) => ({
        composition,
        status: 'impossible' as const,
        constraint: 'TAG_MISMATCH' as const,
        reason,
      })),
    };
  }

  if (entry.unique && alreadyIncluded.has(entry.id)) {
    const reason = t(
      'Es UNIQUE y ya está incluida en la lista.',
      'UNIQUE and already included.',
    );
    return {
      entry,
      status: 'impossible',
      constraint: 'UNIQUE_ALREADY_INCLUDED',
      reason,
      compositions: entry.compositions.map((composition) => ({
        composition,
        status: 'impossible' as const,
        constraint: 'UNIQUE_ALREADY_INCLUDED' as const,
        reason,
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
      compositions: entry.compositions.map((composition) => ({ composition, ...AVAILABLE })),
    };
  }

  // --- Nivel 2: bloqueado por recursos --------------------------------------
  const mineralsLeft = costs.mineralLimit - costs.mineralsSpent;
  const ledger = costs.slots[entry.slotType];
  const slotLabel = SLOT_LABEL[entry.slotType];

  const compositions: Array<{ composition: UnitEntry['compositions'][number] } & UnitCompositionEligibility> = entry.compositions.map((composition) => {
    if (composition.mineralCost > mineralsLeft) {
      return {
        composition,
        status: 'blocked' as const,
        constraint: 'INSUFFICIENT_MINERALS' as const,
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
    const projectedSlotDeficit = Math.max(
      0,
      ledger.used + composition.supplyValue - ledger.total,
    );
    if (projectedSlotDeficit > 0) {
      return {
        composition,
        status: 'provisional' as const,
        constraint: 'INSUFFICIENT_SLOTS' as const,
        projectedSlotDeficit,
        reason: t(
          `Puedes añadirla ahora, pero después faltarán ${projectedSlotDeficit} ${projectedSlotDeficit === 1 ? 'espacio' : 'espacios'} de ${slotLabel}.`,
          `You can add it now, but ${projectedSlotDeficit} ${slotLabel} slot${projectedSlotDeficit === 1 ? '' : 's'} will still be missing.`,
        ),
        remedy: t(
          `Añade Cartas Tácticas que otorguen espacios de ${slotLabel} antes de validar la lista.`,
          `Add Tactical Cards granting ${slotLabel} slots before validating the list.`,
        ),
      };
    }
    return { composition, status: 'available' as const };
  });

  const anyAvailable = compositions.some((c) => c.status === 'available');
  if (anyAvailable) {
    return { entry, ...AVAILABLE, compositions };
  }

  const anyProvisional = compositions.some((c) => c.status === 'provisional');
  if (anyProvisional) {
    const provisional = compositions.find((c) => c.status === 'provisional')!;
    return {
      entry,
      status: 'provisional',
      constraint: 'INSUFFICIENT_SLOTS',
      reason: provisional.reason,
      remedy: provisional.remedy,
      compositions,
    };
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
    constraint: cheapest.constraint,
    compositions,
  };
  if (cheapest.status === 'blocked') {
    if (cheapest.reason) blocked.reason = cheapest.reason;
    if (cheapest.remedy) blocked.remedy = cheapest.remedy;
  }
  return blocked;
}

/**
 * Evalúa el comando de incorporación con el estado actual de la lista. La UI
 * usa `getEligibleUnits` para pintar; el store llama a esta función como
 * segunda línea de defensa para no depender de un estado React antiguo.
 */
export function evaluateRecruitment(
  list: ArmyList,
  index: CatalogIndex,
  unitEntryId: string,
  compositionId: string | null,
  action: 'recruit' | 'addReference',
): RecruitmentResult {
  const faction = list.factionCardId
    ? index.factionCards.get(list.factionCardId)
    : undefined;
  if (!faction || faction.race !== list.race) {
    return { ok: false, constraint: 'MISSING_FACTION' };
  }

  const entry = index.unitEntries.get(unitEntryId);
  if (!entry) return { ok: false, constraint: 'UNKNOWN_UNIT' };
  if (entry.race !== faction.race) {
    return { ok: false, constraint: 'RACE_MISMATCH' };
  }
  if (action === 'recruit' && entry.summoned) {
    return { ok: false, constraint: 'WRONG_RECRUITMENT_ACTION' };
  }
  if (action === 'addReference' && !entry.summoned) {
    return { ok: false, constraint: 'WRONG_RECRUITMENT_ACTION' };
  }
  if (!tagsAreEligible(entry.tags, faction.tags)) {
    return { ok: false, constraint: 'TAG_MISMATCH' };
  }
  if (action === 'recruit' && entry.unique && list.entries.some((e) => !e.reference && e.unitEntryId === entry.id)) {
    return { ok: false, constraint: 'UNIQUE_ALREADY_INCLUDED' };
  }

  const composition = compositionId
    ? entry.compositions.find((candidate) => candidate.id === compositionId)
    : entry.compositions[0];
  if (!composition) return { ok: false, constraint: 'UNKNOWN_COMPOSITION' };

  if (action === 'addReference') {
    return { ok: true, instanceId: newReferenceId() };
  }

  const eligible = classifyUnit(
    entry,
    faction,
    new Set(list.entries.filter((e) => !e.reference).map((e) => e.unitEntryId)),
    computeCosts(list, index),
  ).compositions.find((candidate) => candidate.composition.id === composition.id);
  if (!eligible || !isUnitAddable(eligible.status)) {
    return {
      ok: false,
      constraint: eligible?.constraint === 'INSUFFICIENT_MINERALS'
        ? 'INSUFFICIENT_MINERALS'
        : eligible?.constraint === 'TAG_MISMATCH'
          ? 'TAG_MISMATCH'
          : eligible?.constraint === 'UNIQUE_ALREADY_INCLUDED'
            ? 'UNIQUE_ALREADY_INCLUDED'
            : 'INSUFFICIENT_MINERALS',
    };
  }
  return { ok: true, instanceId: newReferenceId() };
}

// La generación queda aquí para que el resultado puro no dependa del store;
// el store sustituye el identificador por el mismo valor al construir la fila.
function newReferenceId(): string {
  return crypto.randomUUID();
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
