import type { CatalogIndex } from './catalogIndex';
import { findUpgrade } from './catalogIndex';
import {
  computeCosts,
  findComposition,
  isUpgradeAvailableFor,
} from './costing';
import { missingTags, tagsAreEligible } from './tags';
import type {
  ArmyList,
  CostSummary,
  Localized,
  SlotType,
  ValidationIssue,
  ValidationResult,
} from './types';
import { SLOT_TYPES } from './types';

const SLOT_LABEL: Record<SlotType, string> = {
  CORE: 'Núcleo',
  ELITE: 'Élite',
  SUPPORT: 'Apoyo',
  AIR: 'Aéreo',
  HERO: 'Héroe',
};

function issue(
  rule: string,
  ruleRef: string,
  severity: 'error' | 'warning',
  message: Localized,
  extra: Partial<ValidationIssue> = {},
): ValidationIssue {
  return { rule, ruleRef, severity, message, ...extra };
}

const t = (es: string, en: string): Localized => ({ es, en });

/**
 * Valida una lista completa contra R1-R13 y A1-A5.
 * Función pura. Ver docs/02-SDD.md §4.2 para la tabla de reglas.
 */
export function validateList(
  list: ArmyList,
  index: CatalogIndex,
): ValidationResult {
  const summary = computeCosts(list, index);
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const faction = list.factionCardId
    ? index.factionCards.get(list.factionCardId)
    : undefined;

  // --- Precondición: sin carta de facción no hay ejército ---
  if (!faction) {
    errors.push(
      issue(
        'R0',
        '§9.1.2',
        'error',
        t(
          'Falta la Carta de Facción: es obligatoria y define los espacios y las etiquetas.',
          'Faction Card is required.',
        ),
        {
          remedy: t(
            'Elige una Carta de Facción en el paso 1.',
            'Select a Faction Card in step 1.',
          ),
        },
      ),
    );
  }

  checkBudgets(summary, errors, warnings);
  if (faction) checkTags(list, index, errors);
  checkSlots(summary, errors, warnings);
  checkCompositions(list, index, errors);
  checkUniqueCards(list, index, errors);
  checkUpgrades(list, index, errors);
  checkSummoned(list, index, errors);
  checkCreepCard(list, index, faction ? faction.race : null, errors);
  checkScenarios(list, index, errors, warnings);
  checkScaleMinimum(list, index, summary, warnings);

  return { legal: errors.length === 0, errors, warnings, summary };
}

// --- R1, R2 + A1, A2 ---------------------------------------------------------

function checkBudgets(
  summary: CostSummary,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  if (summary.mineralsSpent > summary.mineralLimit) {
    const over = summary.mineralsSpent - summary.mineralLimit;
    errors.push(
      issue(
        'R1',
        '§9.1.3',
        'error',
        t(
          `Te has pasado en ${over} minerales (${summary.mineralsSpent} de ${summary.mineralLimit}).`,
          `Over mineral limit by ${over}.`,
        ),
        {
          remedy: t(
            'Quita una unidad o una mejora, o reduce la composición de alguna unidad.',
            'Remove a unit or an upgrade.',
          ),
        },
      ),
    );
  } else if (summary.mineralsSpent < summary.mineralLimit) {
    const left = summary.mineralLimit - summary.mineralsSpent;
    warnings.push(
      issue(
        'A1',
        '§9.1.3',
        'warning',
        t(
          `Te sobran ${left} minerales. Los minerales no gastados se pierden.`,
          `${left} unspent Minerals are lost.`,
        ),
      ),
    );
  }

  if (summary.vespeneSpent > summary.vespeneLimit) {
    const over = summary.vespeneSpent - summary.vespeneLimit;
    errors.push(
      issue(
        'R2',
        '§9.1.4',
        'error',
        t(
          `Te has pasado en ${over} de Gas Vespeno (${summary.vespeneSpent} de ${summary.vespeneLimit}).`,
          `Over Vespene Gas limit by ${over}.`,
        ),
        {
          remedy: t(
            'Quita una Carta Táctica.',
            'Remove a Tactical Card.',
          ),
        },
      ),
    );
  } else if (summary.vespeneSpent < summary.vespeneLimit) {
    const left = summary.vespeneLimit - summary.vespeneSpent;
    warnings.push(
      issue(
        'A2',
        '§9.1.4',
        'warning',
        t(
          `Te sobran ${left} de Gas Vespeno. El gas no gastado se pierde y no se convierte en minerales.`,
          `${left} unspent Vespene Gas is lost.`,
        ),
      ),
    );
  }
}

// --- R3 ---------------------------------------------------------------------

function checkTags(
  list: ArmyList,
  index: CatalogIndex,
  errors: ValidationIssue[],
): void {
  const faction = index.factionCards.get(list.factionCardId!)!;

  for (const cardId of new Set(list.tacticalCardIds)) {
    const card = index.tacticalCards.get(cardId);
    if (!card) continue;
    if (!tagsAreEligible(card.tags, faction.tags)) {
      const missing = missingTags(card.tags, faction.tags).join(', ');
      errors.push(
        issue(
          'R3',
          '§9.1.2',
          'error',
          t(
            `La Carta Táctica ${card.name} no es elegible: su etiqueta ${missing} no aparece en ${faction.name}.`,
            `Tactical Card ${card.name} is not eligible: missing tag ${missing}.`,
          ),
          {
            remedy: t(
              `Quita ${card.name} o cambia de Carta de Facción.`,
              `Remove ${card.name} or change Faction Card.`,
            ),
          },
        ),
      );
    }
  }

  for (const listEntry of list.entries) {
    const entry = index.unitEntries.get(listEntry.unitEntryId);
    if (!entry) continue;
    if (!tagsAreEligible(entry.tags, faction.tags)) {
      const missing = missingTags(entry.tags, faction.tags).join(', ');
      errors.push(
        issue(
          'R3',
          '§9.1.2',
          'error',
          t(
            `${entry.name} no es elegible: su etiqueta ${missing} no aparece en ${faction.name}.`,
            `${entry.name} is not eligible: missing tag ${missing}.`,
          ),
          {
            entryInstanceId: listEntry.instanceId,
            remedy: t(
              `Quita ${entry.name} o cambia de Carta de Facción.`,
              `Remove ${entry.name} or change Faction Card.`,
            ),
          },
        ),
      );
    }
  }
}

// --- R4 + A3 ----------------------------------------------------------------

function checkSlots(
  summary: CostSummary,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  for (const slotType of SLOT_TYPES) {
    const ledger = summary.slots[slotType];
    const label = SLOT_LABEL[slotType];

    if (ledger.used > ledger.total) {
      const over = ledger.used - ledger.total;
      errors.push(
        issue(
          'R4',
          '§9.1.5',
          'error',
          t(
            over === 1
              ? `Falta 1 espacio de ${label} (usas ${ledger.used} de ${ledger.total}).`
              : `Faltan ${over} espacios de ${label} (usas ${ledger.used} de ${ledger.total}).`,
            `Over ${label} slots by ${over}.`,
          ),
          {
            remedy: t(
              `Compra una Carta Táctica que otorgue espacios de ${label}, o retira una unidad de ese tipo.`,
              `Buy a Tactical Card granting ${label} slots, or remove a unit.`,
            ),
          },
        ),
      );
    } else if (ledger.total > 0 && ledger.used < ledger.total) {
      const left = ledger.total - ledger.used;
      warnings.push(
        issue(
          'A3',
          '§9.1.5',
          'warning',
          t(
            left === 1
              ? `Te sobra 1 espacio de ${label}. Los espacios no usados se pierden.`
              : `Te sobran ${left} espacios de ${label}. Los espacios no usados se pierden.`,
            `${left} unused ${label} slots are lost.`,
          ),
        ),
      );
    }
  }
}

// --- R6 ---------------------------------------------------------------------

function checkCompositions(
  list: ArmyList,
  index: CatalogIndex,
  errors: ValidationIssue[],
): void {
  for (const listEntry of list.entries) {
    const entry = index.unitEntries.get(listEntry.unitEntryId);
    if (!entry) {
      errors.push(
        issue(
          'R6',
          '§9.1.6',
          'error',
          t(
            `Hay una unidad desconocida en la lista (${listEntry.unitEntryId}).`,
            `Unknown unit ${listEntry.unitEntryId}.`,
          ),
          { entryInstanceId: listEntry.instanceId },
        ),
      );
      continue;
    }
    if (listEntry.reference) continue;

    if (!findComposition(entry, listEntry.compositionId)) {
      errors.push(
        issue(
          'R6',
          '§9.1.6',
          'error',
          t(
            `${entry.name} usa un número de modelos que no existe entre sus opciones de composición.`,
            `${entry.name} uses a composition that does not exist.`,
          ),
          {
            entryInstanceId: listEntry.instanceId,
            remedy: t(
              'Elige una de las composiciones disponibles para esta unidad.',
              'Pick an available composition.',
            ),
          },
        ),
      );
    }
  }
}

// --- R7 ---------------------------------------------------------------------

function checkUniqueCards(
  list: ArmyList,
  index: CatalogIndex,
  errors: ValidationIssue[],
): void {
  const cardCounts = new Map<string, number>();
  for (const id of list.tacticalCardIds) {
    cardCounts.set(id, (cardCounts.get(id) ?? 0) + 1);
  }
  for (const [id, count] of cardCounts) {
    const card = index.tacticalCards.get(id);
    if (card?.unique && count > 1) {
      errors.push(
        issue(
          'R7',
          '§9.1.5',
          'error',
          t(
            `${card.name} está marcada como UNIQUE: solo puede incluirse una copia, y tienes ${count}.`,
            `${card.name} is UNIQUE but included ${count} times.`,
          ),
          {
            remedy: t(
              `Quita ${count - 1} copia(s) de ${card.name}.`,
              `Remove ${count - 1} copies.`,
            ),
          },
        ),
      );
    }
  }

  const unitCounts = new Map<string, number>();
  for (const listEntry of list.entries) {
    if (listEntry.reference) continue;
    unitCounts.set(
      listEntry.unitEntryId,
      (unitCounts.get(listEntry.unitEntryId) ?? 0) + 1,
    );
  }
  for (const [id, count] of unitCounts) {
    const entry = index.unitEntries.get(id);
    if (entry?.unique && count > 1) {
      errors.push(
        issue(
          'R7',
          '§9.1.5',
          'error',
          t(
            `${entry.name} está marcada como UNIQUE: solo puede incluirse una vez, y tienes ${count}.`,
            `${entry.name} is UNIQUE but included ${count} times.`,
          ),
          {
            remedy: t(
              `Quita ${count - 1} copia(s) de ${entry.name}.`,
              `Remove ${count - 1} copies.`,
            ),
          },
        ),
      );
    }
  }
}

// --- R8, R9 -----------------------------------------------------------------

function checkUpgrades(
  list: ArmyList,
  index: CatalogIndex,
  errors: ValidationIssue[],
): void {
  for (const listEntry of list.entries) {
    const entry = index.unitEntries.get(listEntry.unitEntryId);
    if (!entry) continue;

    const composition = findComposition(entry, listEntry.compositionId);
    const seen = new Set<string>();
    // Modelos ya ocupados por una mejora SPECIALIST: la asignación debe ser
    // inyectiva (§9.1.7). Dos especialistas distintas en el mismo modelo no vale.
    const specialistModels = new Map<number, string>();

    for (const applied of listEntry.upgrades) {
      const upgrade = findUpgrade(index, entry.id, applied.upgradeId);
      if (!upgrade) {
        errors.push(
          issue(
            'R9',
            '§9.1.7',
            'error',
            t(
              `${entry.name} tiene una mejora que no existe en su carta (${applied.upgradeId}).`,
              `Unknown upgrade ${applied.upgradeId}.`,
            ),
            { entryInstanceId: listEntry.instanceId },
          ),
        );
        continue;
      }

      // R9: cada mejora, una sola vez por unidad.
      if (seen.has(upgrade.id)) {
        errors.push(
          issue(
            'R9',
            '§9.1.7',
            'error',
            t(
              `${entry.name} tiene ${upgrade.name} comprada más de una vez. Cada mejora debe ser una entrada distinta.`,
              `${upgrade.name} purchased more than once.`,
            ),
            {
              entryInstanceId: listEntry.instanceId,
              remedy: t(
                `Quita la copia sobrante de ${upgrade.name}.`,
                `Remove the duplicate.`,
              ),
            },
          ),
        );
        continue;
      }
      seen.add(upgrade.id);

      if (!isUpgradeAvailableFor(upgrade, listEntry.compositionId)) {
        errors.push(
          issue(
            'R9',
            '§9.1.7',
            'error',
            t(
              `${upgrade.name} no está disponible para la composición elegida de ${entry.name}.`,
              `${upgrade.name} is not available for the chosen composition.`,
            ),
            { entryInstanceId: listEntry.instanceId },
          ),
        );
      }

      if (upgrade.specialist) {
        // R8: SPECIALIST nomina un modelo concreto.
        if (applied.modelIndex === null) {
          errors.push(
            issue(
              'R8',
              '§9.1.7',
              'error',
              t(
                `${upgrade.name} es SPECIALIST: hay que nominar qué modelo de ${entry.name} la lleva.`,
                `${upgrade.name} is SPECIALIST and needs a nominated model.`,
              ),
              {
                entryInstanceId: listEntry.instanceId,
                remedy: t(
                  'Selecciona el modelo que porta esta mejora.',
                  'Nominate the model carrying it.',
                ),
              },
            ),
          );
        } else {
          const models = composition?.models ?? 0;
          if (applied.modelIndex < 0 || applied.modelIndex >= models) {
            errors.push(
              issue(
                'R8',
                '§9.1.7',
                'error',
                t(
                  `${upgrade.name} está asignada a un modelo que no existe: ${entry.name} tiene ${models} modelos.`,
                  `${upgrade.name} assigned to a non-existent model.`,
                ),
                { entryInstanceId: listEntry.instanceId },
              ),
            );
          }
          const occupant = specialistModels.get(applied.modelIndex);
          if (occupant) {
            errors.push(
              issue(
                'R8',
                '§9.1.7',
                'error',
                t(
                  `Dos mejoras SPECIALIST (${occupant} y ${upgrade.name}) están asignadas al mismo modelo. Cada una debe ir en un modelo distinto.`,
                  `Two SPECIALIST upgrades assigned to the same model.`,
                ),
                {
                  entryInstanceId: listEntry.instanceId,
                  remedy: t(
                    'Asigna cada mejora SPECIALIST a un modelo diferente.',
                    'Assign each SPECIALIST upgrade to a different model.',
                  ),
                },
              ),
            );
          } else {
            specialistModels.set(applied.modelIndex, upgrade.name);
          }
        }
      } else if (applied.modelIndex !== null) {
        errors.push(
          issue(
            'R8',
            '§9.1.7',
            'error',
            t(
              `${upgrade.name} no es SPECIALIST: se aplica a todos los modelos y no debe nominar uno.`,
              `${upgrade.name} is not SPECIALIST and must not nominate a model.`,
            ),
            { entryInstanceId: listEntry.instanceId },
          ),
        );
      }
    }
  }
}

// --- R10 --------------------------------------------------------------------

function checkSummoned(
  list: ArmyList,
  index: CatalogIndex,
  errors: ValidationIssue[],
): void {
  for (const listEntry of list.entries) {
    const entry = index.unitEntries.get(listEntry.unitEntryId);
    if (!entry) continue;

    // Una unidad invocada solo puede estar en la lista como referencia: si
    // entrara como unidad reclutada computaría minerales y espacios (§9.1.9).
    if (entry.summoned && !listEntry.reference) {
      errors.push(
        issue(
          'R10',
          '§9.1.9',
          'error',
          t(
            `${entry.name} es una unidad invocada: no se recluta ni ocupa espacios.`,
            `${entry.name} is a Summoned Unit and cannot be mustered.`,
          ),
          {
            entryInstanceId: listEntry.instanceId,
            remedy: t(
              'Márcala como referencia o quítala de la lista.',
              'Mark it as reference or remove it.',
            ),
          },
        ),
      );
    }

    if (!entry.summoned && listEntry.reference) {
      errors.push(
        issue(
          'R10',
          '§9.1.9',
          'error',
          t(
            `${entry.name} no es una unidad invocada: no puede estar como referencia sin computar.`,
            `${entry.name} is not a Summoned Unit.`,
          ),
          { entryInstanceId: listEntry.instanceId },
        ),
      );
    }
  }
}

// --- R11 --------------------------------------------------------------------

function checkCreepCard(
  list: ArmyList,
  index: CatalogIndex,
  race: string | null,
  errors: ValidationIssue[],
): void {
  if (race !== 'ZERG') {
    if (list.creepCardId) {
      errors.push(
        issue(
          'R11',
          'ZERG CREEP',
          'error',
          t(
            'Solo los ejércitos Zerg pueden incluir una Creep Card.',
            'Only Zerg armies may include a Creep Card.',
          ),
        ),
      );
    }
    return;
  }

  // Exactamente una: cero es tan ilegal como dos.
  if (!list.creepCardId) {
    errors.push(
      issue(
        'R11',
        'ZERG CREEP',
        'error',
        t(
          'Falta la Creep Card. Tu Carta de Facción obliga a incluir exactamente una durante la construcción.',
          'Exactly one Creep Card is required.',
        ),
        {
          remedy: t(
            'Elige Accelerating Creep (0 de gas) o Malignant Creep (10 de gas).',
            'Choose one Creep Card.',
          ),
        },
      ),
    );
  } else if (!index.creepCards.get(list.creepCardId)) {
    errors.push(
      issue(
        'R11',
        'ZERG CREEP',
        'error',
        t(
          'La Creep Card seleccionada no existe en el catálogo.',
          'Selected Creep Card does not exist.',
        ),
      ),
    );
  }
}

// --- R12, R13 ---------------------------------------------------------------

function checkScenarios(
  list: ArmyList,
  index: CatalogIndex,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
): void {
  const check = (
    ids: string[],
    kind: 'mission' | 'deployment',
  ): void => {
    const label = kind === 'mission' ? 'misión' : 'despliegue';
    const lookup =
      kind === 'mission' ? index.missionCards : index.deploymentCards;

    if (ids.length !== 2) {
      errors.push(
        issue(
          'R12',
          '§9.2',
          'error',
          t(
            `Debes llevar exactamente 2 cartas de ${label} al draft, y llevas ${ids.length}.`,
            `Exactly 2 ${kind} cards required, found ${ids.length}.`,
          ),
          {
            remedy: t(
              `Selecciona ${2 - ids.length > 0 ? 2 - ids.length : 0} carta(s) más de ${label}.`,
              `Adjust your ${kind} card selection.`,
            ),
          },
        ),
      );
    }

    if (new Set(ids).size !== ids.length) {
      errors.push(
        issue(
          'R12',
          '§9.2',
          'error',
          t(
            `No puedes llevar dos copias de la misma carta de ${label} en tu propio conjunto.`,
            `Duplicate ${kind} cards in your own set are not allowed.`,
          ),
          {
            remedy: t(
              `Cambia una de las cartas de ${label} por otra distinta.`,
              `Replace one with a different card.`,
            ),
          },
        ),
      );
    }

    // R13: aviso, no error. El reglamento no lo prohíbe explícitamente, pero
    // llevar una carta de otra escala descuadra suministro y duración.
    for (const id of ids) {
      const card = lookup.get(id);
      if (card && card.scale !== list.scaleId) {
        warnings.push(
          issue(
            'R13',
            kind === 'mission' ? '§5.5' : '§5.6',
            'warning',
            t(
              `${card.name} está diseñada para otra escala de enfrentamiento.`,
              `${card.name} is designed for a different Engagement Scale.`,
            ),
          ),
        );
      }
    }
  };

  check(list.missionCardIds, 'mission');
  check(list.deploymentCardIds, 'deployment');
}

// --- A5 ---------------------------------------------------------------------

function checkScaleMinimum(
  list: ArmyList,
  index: CatalogIndex,
  summary: CostSummary,
  warnings: ValidationIssue[],
): void {
  const scale = index.catalog.scales.find((s) => s.id === list.scaleId);
  if (!scale) return;
  if (scale.mineralMinimum > 0 && summary.mineralLimit < scale.mineralMinimum) {
    warnings.push(
      issue(
        'A5',
        '§9.1.1',
        'warning',
        t(
          `El límite de ${summary.mineralLimit} minerales no alcanza el mínimo de ${scale.mineralMinimum} de esta escala.`,
          `Mineral limit below the scale minimum.`,
        ),
      ),
    );
  }
}
