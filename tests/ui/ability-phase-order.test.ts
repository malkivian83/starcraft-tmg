import { describe, expect, it } from 'vitest';
import { groupAbilitiesByPhase, groupPurchasedUpgrades, groupUnitProfileByPhase, UNIT_CARD_PHASE_ORDER } from '@/ui/common/abilityPhases';
import { loadCatalog } from '@/catalog/loader';

describe('orden de fases de las cartas de unidad', () => {
  it('sigue Any, Movement, Assault y Combat', () => {
    expect(UNIT_CARD_PHASE_ORDER).toEqual([
      'ANY',
      'MOVEMENT',
      'ASSAULT',
      'COMBAT',
    ]);
  });

  it('agrupa habilidades en el orden de la carta aunque los datos vengan mezclados', () => {
    const grouped = groupAbilitiesByPhase([
      { name: 'Combat', phase: 'COMBAT' as const },
      { name: 'Movement', phase: 'MOVEMENT' as const },
      { name: 'Any', phase: 'ANY' as const },
      { name: 'Assault', phase: 'ASSAULT' as const },
    ]);

    expect(grouped.map(([phase]) => phase)).toEqual([
      'ANY',
      'MOVEMENT',
      'ASSAULT',
      'COMBAT',
    ]);
  });

  it('mantiene las armas dentro de su fase', () => {
    const kerrigan = loadCatalog('ZERG').catalog.unitCards.find(
      (card) => card.id === 'zerg.card.kerrigan',
    );
    expect(kerrigan).toBeDefined();

    const grouped = groupUnitProfileByPhase(kerrigan!.weapons, kerrigan!.abilities);
    expect(grouped.map((group) => [group.phase, group.weapons.map((weapon) => weapon.name)])).toEqual([
      ['ANY', []],
      ['MOVEMENT', []],
      ['ASSAULT', ['Energy Blast']],
      ['COMBAT', ['Blades']],
    ]);
  });

  it('agrupa las mejoras compradas por la fase que otorgan', () => {
    const hydralisk = loadCatalog('ZERG').catalog.unitEntries.find(
      (entry) => entry.id === 'zerg.entry.hydralisk',
    );
    expect(hydralisk).toBeDefined();

    const purchased = hydralisk!.upgrades.slice(0, 3).map((upgrade) => ({
      upgrade,
      applied: { upgradeId: upgrade.id, modelIndex: null },
    }));
    expect(groupPurchasedUpgrades(purchased).map((group) => [
      group.phase,
      group.upgrades.map(({ upgrade }) => upgrade.name),
    ])).toEqual([
      ['ANY', ['Ancillary Carapace']],
      ['MOVEMENT', ['Burrow Ambush']],
      ['ASSAULT', ['Grooved Spines']],
    ]);
  });
});
