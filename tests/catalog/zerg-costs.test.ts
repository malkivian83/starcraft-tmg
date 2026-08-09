import { describe, expect, it } from 'vitest';
import { loadCatalog } from '@/catalog/loader';

// Transcripción contrastada con Reglamento §12.10 y §12.11 (mayo de 2026).
const UNIT_COSTS = {
  'zerg.entry.zergling': { compositions: { '12': 180, '18': 220 }, upgrades: { adrenal_glands: { '12': 20, '18': 20 }, burrow_ambush: { '12': 20, '18': 30 }, shredding_claws: { '12': 10, '18': 10 } } },
  'zerg.entry.raptor': { compositions: { '12': 240, '18': 300 }, upgrades: { adrenal_glands: { '12': 20, '18': 20 }, burrow_ambush: { '12': 20, '18': 30 }, shredding_claws: { '12': 10, '18': 10 } } },
  'zerg.entry.kerrigan_swarm_raptor': { compositions: { '6': 250 }, upgrades: {} },
  'zerg.entry.swarmling': { compositions: { '18': 260 }, upgrades: { burrow_ambush: { '18': 20 } } },
  'zerg.entry.roach': { compositions: { '3': 170 }, upgrades: { burrow_ambush: { '3': 20 }, glial_reconstitution: { '3': 20 }, hydriodic_bile: { '3': 10 }, tunneling_claws: { '3': 10 } } },
  'zerg.entry.vile': { compositions: { '3': 200 }, upgrades: { burrow_ambush: { '3': 20 }, glial_reconstitution: { '3': 20 }, hydriodic_bile: { '3': 10 }, tunneling_claws: { '3': 10 } } },
  'zerg.entry.corpser': { compositions: { '3': 240 }, upgrades: { burrow_ambush: { '3': 20 }, glial_reconstitution: { '3': 20 }, hydriodic_bile: { '3': 10 }, tunneling_claws: { '3': 10 } } },
  'zerg.entry.hydralisk': { compositions: { '2': 140, '4': 260 }, upgrades: { ancillary_carapace: { '2': 20, '4': 40 }, burrow_ambush: { '2': 20, '4': 40 }, grooved_spines: { '2': 20, '4': 40 }, lurking: { '2': 10, '4': 20 } } },
  'zerg.entry.queen': { compositions: { '1': 150 }, upgrades: { creep_speed: { '1': 10 }, domineering_presence: { '1': 10 } } },
  'zerg.entry.kerrigan': { compositions: { '1': 250 }, upgrades: {} },
} as const;

const GAS_COSTS = {
  'zerg.tactical.spawning_pool': 25, 'zerg.tactical.spawning_pool_six_pool': 40,
  'zerg.tactical.roach_warren': 25, 'zerg.tactical.hydralisk_den': 35,
  'zerg.tactical.evolution_chamber': 30, 'zerg.tactical.hatchery': 30,
  'zerg.tactical.lair': 35, 'zerg.tactical.overlord': 35, 'zerg.tactical.overseer': 25,
  'zerg.creep.accelerating_creep': 0, 'zerg.creep.malignant_creep': 10,
} as const;

describe('Costes Zerg del reglamento', () => {
  const catalog = loadCatalog('ZERG').catalog;

  it('mantiene los minerales y mejoras de §12.10', () => {
    for (const [entryId, expected] of Object.entries(UNIT_COSTS)) {
      const entry = catalog.unitEntries.find((item) => item.id === entryId)!;
      expect(Object.fromEntries(entry.compositions.map((item) => [item.id, item.mineralCost]))).toEqual(expected.compositions);
      expect(Object.fromEntries(entry.upgrades.map((item) => [item.id, item.costByComposition]))).toEqual(expected.upgrades);
    }
  });

  it('mantiene el gas de tácticas y Creep de §12.11', () => {
    const cards = [...catalog.tacticalCards, ...catalog.creepCards];
    expect(Object.fromEntries(cards.map((item) => [item.id, item.vespeneCost]))).toEqual(GAS_COSTS);
  });

  it('sitúa Mutating Carapace de Kerrigan en la fase de movimiento', () => {
    const kerrigan = catalog.unitCards.find((card) => card.id === 'zerg.card.kerrigan');
    const mutatingCarapace = kerrigan?.abilities.find(
      (ability) => ability.name === 'Mutating Carapace',
    );

    expect(mutatingCarapace?.phase).toBe('MOVEMENT');
  });

  it('conserva el recurso explícito de Glial Reconstitution', () => {
    for (const entryId of [
      'zerg.entry.roach',
      'zerg.entry.corpser',
    ]) {
      const upgrade = catalog.unitEntries
        .find((entry) => entry.id === entryId)
        ?.upgrades.find((item) => item.id === 'glial_reconstitution');

      expect(upgrade?.grantsAbilities[0]).toMatchObject({
        cost: 1,
        resource: 'CP',
      });
    }

    const vileUpgrade = catalog.unitEntries
      .find((entry) => entry.id === 'zerg.entry.vile')
      ?.upgrades.find((item) => item.id === 'glial_reconstitution');
    expect(vileUpgrade?.grantsAbilities[0]?.cost).toBe(1);
    expect(vileUpgrade?.grantsAbilities[0]?.resource).toBeUndefined();
  });
});
