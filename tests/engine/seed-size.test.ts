import { describe, expect, it } from 'vitest';
import { encodeSeed } from '@/engine/seed/codec';
import { emptyList, entry, indexFor, manualExampleList } from '../fixtures';

const zerg = indexFor('ZERG');
const terran = indexFor('TERRAN');

/**
 * Documenta el tamaño real del seed en escenarios típicos. Si una lista
 * pequeña deja de caber en un código corto, aquí se ve antes de que el usuario
 * se encuentre con una cadena inmanejable.
 */
describe('Tamaño del seed', () => {
  it('lista Zerg pequeña', () => {
    const list = emptyList({
      factionCardId: 'zerg.faction.zerg_swarm',
      creepCardId: 'zerg.creep.accelerating_creep',
      tacticalCardIds: ['zerg.tactical.spawning_pool'],
      entries: [entry('zerg.entry.zergling', '12'), entry('zerg.entry.roach', '3')],
      missionCardIds: [
        'mission.frontlines.standard',
        'mission.supply_drop.standard',
      ],
      deploymentCardIds: ['deployment.gauntlet', 'deployment.typhoon'],
    });
    const seed = encodeSeed(list, zerg);
    console.log(`  Zerg pequeña  → ${seed.length} caracteres: ${seed}`);
    expect(seed.length).toBeLessThan(110);
  });

  it('lista completa del manual (9 unidades, 6 tácticas)', () => {
    const seed = encodeSeed(manualExampleList(), terran);
    console.log(`  Manual §9.1   → ${seed.length} caracteres: ${seed}`);
    expect(seed.length).toBeLessThan(160);
  });

  it('lista grande con muchas mejoras', () => {
    const list = emptyList({
      race: 'TERRAN',
      factionCardId: 'terran.faction.terran_armed_forces',
      tacticalCardIds: [
        'terran.tactical.barracks',
        'terran.tactical.barracks_proxy',
        'terran.tactical.factory',
        'terran.tactical.armory',
        'terran.tactical.academy',
      ],
      entries: [
        entry('terran.entry.marine', '9', [
          { upgradeId: 'agg_12', modelIndex: 0 },
          { upgradeId: 'rocket_launcher', modelIndex: 1 },
          { upgradeId: 'combat_shield', modelIndex: null },
          { upgradeId: 'slugthrower', modelIndex: null },
        ]),
        entry('terran.entry.marine', '9', [
          { upgradeId: 'combat_shield', modelIndex: null },
        ]),
        entry('terran.entry.marauder', '4', [
          { upgradeId: 'kinetic_foam', modelIndex: null },
          { upgradeId: 'veteran_of_tarsonis', modelIndex: null },
        ]),
        entry('terran.entry.medic', '3', [
          { upgradeId: 'stabilizer_medpacks', modelIndex: null },
        ]),
        entry('terran.entry.goliath', '1'),
      ],
      missionCardIds: [
        'mission.frontlines.standard',
        'mission.hold_position.standard',
      ],
      deploymentCardIds: ['deployment.acropolis', 'deployment.breach'],
    });
    const seed = encodeSeed(list, terran);
    console.log(`  Terran grande → ${seed.length} caracteres: ${seed}`);
    expect(seed.length).toBeLessThan(200);
  });
});
