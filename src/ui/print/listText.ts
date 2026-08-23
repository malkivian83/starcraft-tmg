import { findComposition, upgradeCostFor } from '@/engine/costing';
import type { CatalogIndex } from '@/engine/catalogIndex';
import type { ArmyList, CostSummary, ValidationResult } from '@/engine/types';
import { SLOT_TYPES } from '@/engine/types';
import { slotLabel } from '../common/Chips';

/**
 * Formato compacto de la hoja de lista para pegar en chats y foros.
 *
 * Deliberadamente no incluye UnitReference: esa sección de la hoja impresa
 * contiene las fichas/perfiles de las tropas y no forma parte del resumen que
 * se comparte con este botón.
 */
export function formatListAsText(
  {
    list,
    index,
    summary,
    validation,
  }: {
    list: ArmyList;
    index: CatalogIndex;
    summary: CostSummary;
    validation: ValidationResult;
  },
  t: (key: string) => string,
  locale: 'es' | 'en',
  share: { seed: string; url: string },
): string {
  const faction = list.factionCardId
    ? index.factionCards.get(list.factionCardId)
    : undefined;
  const creep = list.creepCardId
    ? index.creepCards.get(list.creepCardId)
    : undefined;
  const mustered = list.entries.filter((entry) => !entry.reference);
  const referenced = list.entries.filter((entry) => entry.reference);
  const resource = summary.resourceType
    ? ` · ${summary.resourcePerRound} ${summary.resourceType}/${t('perRound')}`
    : '';

  const lines = [
    list.name,
    `${list.race} · ${scaleLabel(list.scaleId, t)} · ${summary.mineralsSpent}/${summary.mineralLimit} ${t('minerals')} · ${summary.vespeneSpent}/${summary.vespeneLimit} ${t('gas')}${resource} · ${t('supply')} ${summary.totalSupply}`,
  ];

  if (!validation.legal) lines.push(t('invalid'));

  lines.push('', t('commandCards'));
  lines.push(
    `${t('faction')}: ${faction?.name ?? t('noValue')}`
      + (creep ? ` · ${t('creep')}: ${creep.name} (${creep.vespeneCost} ${t('gas')})` : ''),
  );
  if (list.tacticalCardIds.length > 0) {
    lines.push(
      `${t('tactics')}: ${list.tacticalCardIds
        .map((id) => {
          const card = index.tacticalCards.get(id);
          return card ? `${card.name} (${card.vespeneCost})` : id;
        })
        .join(' · ')}`,
    );
  }

  lines.push('', t('armySlots'));
  lines.push(
    SLOT_TYPES.filter((type) => summary.slots[type].total > 0)
      .map((type) => `${slotLabel(type, locale)} ${summary.slots[type].used}/${summary.slots[type].total}`)
      .join(' · ') || t('noValue'),
  );

  lines.push('', t('units'));
  for (const listEntry of mustered) {
    const unit = index.unitEntries.get(listEntry.unitEntryId);
    if (!unit) continue;
    const composition = findComposition(unit, listEntry.compositionId);
    const upgradeCost = listEntry.upgrades.reduce((total, applied) => {
      const upgrade = unit.upgrades.find((candidate) => candidate.id === applied.upgradeId);
      return total + (upgrade ? (upgradeCostFor(upgrade, listEntry.compositionId) ?? 0) : 0);
    }, 0);
    const upgrades = listEntry.upgrades
      .map((applied) => unit.upgrades.find((upgrade) => upgrade.id === applied.upgradeId)?.name ?? applied.upgradeId)
      .join(', ') || t('noValue');

    lines.push(
      `• ${unit.name} · ${t('models')}: ${composition?.models ?? t('noValue')} · ${t('supplyShort')}: ${composition?.supplyValue ?? t('noValue')} · ${t('slot')}: ${slotLabel(unit.slotType, locale)} · ${t('upgrades')}: ${upgrades} · ${composition ? composition.mineralCost + upgradeCost : 0} ${t('minerals')}`,
    );
  }
  lines.push(`${t('total')}: ${summary.mineralsSpent} ${t('minerals')}`);

  if (referenced.length > 0) {
    lines.push('', t('summoned'));
    lines.push(
      referenced
        .map((entry) => index.unitEntries.get(entry.unitEntryId)?.name ?? entry.unitEntryId)
        .join(' · '),
    );
  }

  lines.push('', t('draftScenarios'));
  lines.push(
    `${t('missions')}: ${list.missionCardIds
      .map((id) => {
        const mission = index.missionCards.get(id);
        return mission ? `${mission.name} (${scaleLabel(mission.scale, t)})` : id;
      })
      .join(' · ') || t('noValue')}`,
  );
  lines.push(
    `${t('deployments')}: ${list.deploymentCardIds
      .map((id) => index.deploymentCards.get(id)?.name ?? id)
      .join(' · ') || t('noValue')}`,
  );

  lines.push('', t('seedLink'), share.url, `${t('seed')}: ${share.seed}`);

  return lines.join('\n');
}

function scaleLabel(scale: string, t: (key: string) => string): string {
  return scale === 'skirmish' ? t('scaleSkirmish') : scale === 'standard' ? t('scaleStandard') : t('scaleGrandOffensive');
}
