import type { Ability, AppliedUpgrade, Phase, UpgradeOption, Weapon } from '@/engine/types';

/** Orden visual impreso en las cartas de unidad oficiales. */
export const UNIT_CARD_PHASE_ORDER = [
  'ANY',
  'MOVEMENT',
  'ASSAULT',
  'COMBAT',
] as const satisfies readonly Phase[];

export function groupAbilitiesByPhase<T extends { phase: Phase }>(abilities: T[]) {
  return UNIT_CARD_PHASE_ORDER
    .map((phase) => [phase, abilities.filter((ability) => ability.phase === phase)] as const)
    .filter(([, grouped]) => grouped.length > 0);
}

export function groupUnitProfileByPhase(weapons: Weapon[], abilities: Ability[]) {
  return UNIT_CARD_PHASE_ORDER
    .map((phase) => ({
      phase,
      weapons: weapons.filter((weapon) => weapon.phase === phase),
      abilities: abilities.filter((ability) => ability.phase === phase),
    }))
    .filter((group) => group.weapons.length > 0 || group.abilities.length > 0);
}

export type PurchasedUpgrade = { applied: AppliedUpgrade; upgrade: UpgradeOption };

export function groupPurchasedUpgrades(upgrades: PurchasedUpgrade[]) {
  return UNIT_CARD_PHASE_ORDER
    .map((phase) => ({
      phase,
      upgrades: upgrades.filter(({ upgrade }) => upgradePhase(upgrade) === phase),
    }))
    .filter((group) => group.upgrades.length > 0);
}

export function groupUpgradesByPhase(upgrades: UpgradeOption[]) {
  return UNIT_CARD_PHASE_ORDER
    .map((phase) => ({
      phase,
      upgrades: upgrades.filter((upgrade) => upgradePhase(upgrade) === phase),
    }))
    .filter((group) => group.upgrades.length > 0);
}

function upgradePhase(upgrade: UpgradeOption): Phase {
  return upgrade.grantsAbilities[0]?.phase ?? upgrade.grantsWeapons[0]?.phase ?? 'ANY';
}
