import { describe, expect, it } from 'vitest';
import { getEligibleUnits } from '@/engine/eligibility';
import { tagsAreEligible } from '@/engine/tags';
import { validateList } from '@/engine/validate';
import { emptyList, entry, indexFor } from '../fixtures';

const zerg = indexFor('ZERG');
const terran = indexFor('TERRAN');

/** Lista Zerg base legal: facción + creep + escenarios completos. */
function zergBase(overrides = {}) {
  return emptyList({
    factionCardId: 'zerg.faction.zerg_swarm',
    creepCardId: 'zerg.creep.accelerating_creep',
    missionCardIds: [
      'mission.gather_the_resources.standard',
      'mission.divide_and_conquer.standard',
    ],
    deploymentCardIds: ['deployment.gauntlet', 'deployment.typhoon'],
    ...overrides,
  });
}

const rules = (list: Parameters<typeof validateList>[0], idx = zerg) =>
  validateList(list, idx).errors.map((e) => e.rule);

describe('R1 — límite de minerales', () => {
  it('da error al superar el presupuesto', () => {
    const list = zergBase({
      mineralLimit: 200,
      tacticalCardIds: ['zerg.tactical.spawning_pool'],
      entries: [entry('zerg.entry.zergling', '18')], // 220 > 200
    });
    expect(rules(list)).toContain('R1');
  });

  it('no da error si encaja justo', () => {
    const list = zergBase({
      mineralLimit: 220,
      tacticalCardIds: ['zerg.tactical.spawning_pool'],
      entries: [entry('zerg.entry.zergling', '18')],
    });
    expect(rules(list)).not.toContain('R1');
  });
});

describe('R2 — límite de gas vespeno', () => {
  it('el gas es el 10 % de los minerales, no una constante', () => {
    const list = zergBase({ mineralLimit: 1000 });
    expect(validateList(list, zerg).summary.vespeneLimit).toBe(100);
  });

  it('la Creep Card computa dentro del límite de gas', () => {
    const list = zergBase({
      mineralLimit: 100, // 10 de gas
      creepCardId: 'zerg.creep.malignant_creep', // cuesta 10
    });
    expect(validateList(list, zerg).summary.vespeneSpent).toBe(10);
    expect(rules(list)).not.toContain('R2');
  });
});

describe('R3 — etiquetas: SUBCONJUNTO, no intersección', () => {
  it('acepta una unidad cuyas etiquetas están todas en la facción', () => {
    expect(tagsAreEligible(['ZERG'], ['ZERG', "KERRIGAN'S SWARM"])).toBe(true);
  });

  it('RECHAZA el contraejemplo del reglamento §9.1.2', () => {
    // Kerrigan Swarm Raptor (Zerg, Kerrigan's Swarm) con una facción que solo
    // tiene Zerg: comparten "Zerg", pero falta "Kerrigan's Swarm".
    // Una implementación por intersección lo aceptaría — y estaría mal.
    expect(tagsAreEligible(['ZERG', "KERRIGAN'S SWARM"], ['ZERG'])).toBe(false);
  });

  it('marca como imposible el Kerrigan Swarm Raptor bajo Zerg Swarm', () => {
    const units = getEligibleUnits(zergBase(), zerg);
    const raptor = units.find(
      (u) => u.entry.id === 'zerg.entry.kerrigan_swarm_raptor',
    );
    expect(raptor?.status).toBe('impossible');
  });

  it('lo permite bajo Kerrigan’s Swarm', () => {
    const list = zergBase({ factionCardId: 'zerg.faction.kerrigans_swarm' });
    const units = getEligibleUnits(list, zerg);
    const raptor = units.find(
      (u) => u.entry.id === 'zerg.entry.kerrigan_swarm_raptor',
    );
    expect(raptor?.status).toBe('available');
  });

  it('da error si la unidad ilegal llega a la lista', () => {
    const list = zergBase({
      entries: [entry('zerg.entry.kerrigan_swarm_raptor', '6')],
    });
    expect(rules(list)).toContain('R3');
  });
});

describe('R4/R5 — espacios de ejército', () => {
  it('una unidad ocupa espacios iguales a su valor de suministro', () => {
    // Hydralisk de 4 modelos: suministro 3 → 3 espacios de Élite.
    const list = zergBase({ entries: [entry('zerg.entry.hydralisk', '4')] });
    expect(validateList(list, zerg).summary.slots.ELITE.used).toBe(3);
  });

  it('da error cuando faltan espacios', () => {
    // Zerg Swarm da 1 espacio de Élite; el Hydralisk de 4 necesita 3.
    const list = zergBase({ entries: [entry('zerg.entry.hydralisk', '4')] });
    expect(rules(list)).toContain('R4');
  });

  it('se resuelve comprando la carta táctica adecuada', () => {
    const list = zergBase({
      entries: [entry('zerg.entry.hydralisk', '4')],
      tacticalCardIds: ['zerg.tactical.hydralisk_den'], // +2 Élite
    });
    expect(rules(list)).not.toContain('R4');
  });

  it('el remedio nombra la carta que desbloquea el espacio', () => {
    const list = zergBase({ entries: [entry('zerg.entry.hydralisk', '4')] });
    const error = validateList(list, zerg).errors.find((e) => e.rule === 'R4');
    expect(error?.remedy?.es).toContain('Élite');
  });
});

describe('R6 — composiciones', () => {
  it('rechaza un número de modelos que no existe', () => {
    const list = zergBase({ entries: [entry('zerg.entry.zergling', '7')] });
    expect(rules(list)).toContain('R6');
  });
});

describe('R7 — cartas y unidades UNIQUE', () => {
  it('rechaza dos copias de una carta táctica UNIQUE', () => {
    const list = zergBase({
      tacticalCardIds: ['zerg.tactical.lair', 'zerg.tactical.lair'],
    });
    expect(rules(list)).toContain('R7');
  });

  it('permite dos copias de una carta que no es UNIQUE', () => {
    const list = zergBase({
      tacticalCardIds: [
        'zerg.tactical.spawning_pool',
        'zerg.tactical.spawning_pool',
      ],
    });
    expect(rules(list)).not.toContain('R7');
  });

  it('rechaza dos Kerrigan', () => {
    const list = zergBase({
      factionCardId: 'zerg.faction.kerrigans_swarm',
      entries: [entry('zerg.entry.kerrigan', '1'), entry('zerg.entry.kerrigan', '1')],
    });
    expect(rules(list)).toContain('R7');
  });
});

describe('R8 — mejoras SPECIALIST', () => {
  const marines = (upgrades: Array<[string, number | null]>) =>
    emptyList({
      race: 'TERRAN',
      factionCardId: 'terran.faction.terran_armed_forces',
      tacticalCardIds: ['terran.tactical.barracks'],
      missionCardIds: ['mission.frontlines.standard', 'mission.supply_drop.standard'],
      deploymentCardIds: ['deployment.gauntlet', 'deployment.typhoon'],
      entries: [
        entry(
          'terran.entry.marine',
          '6',
          upgrades.map(([upgradeId, modelIndex]) => ({ upgradeId, modelIndex })),
        ),
      ],
    });

  it('exige nominar un modelo', () => {
    expect(rules(marines([['agg_12', null]]), terran)).toContain('R8');
  });

  it('acepta la mejora nominada a un modelo válido', () => {
    expect(rules(marines([['agg_12', 0]]), terran)).not.toContain('R8');
  });

  it('rechaza un modelo fuera del tamaño de la unidad', () => {
    // 6 modelos: índices válidos 0-5.
    expect(rules(marines([['agg_12', 6]]), terran)).toContain('R8');
  });

  it('rechaza dos SPECIALIST distintas en el mismo modelo', () => {
    expect(
      rules(marines([['agg_12', 0], ['rocket_launcher', 0]]), terran),
    ).toContain('R8');
  });

  it('acepta dos SPECIALIST distintas en modelos distintos', () => {
    // El reglamento §9.1.7 lo permite expresamente.
    expect(
      rules(marines([['agg_12', 0], ['rocket_launcher', 1]]), terran),
    ).not.toContain('R8');
  });

  it('rechaza nominar modelo en una mejora que no es SPECIALIST', () => {
    expect(rules(marines([['combat_shield', 0]]), terran)).toContain('R8');
  });
});

describe('R9 — mejoras duplicadas y coste por composición', () => {
  it('rechaza la misma mejora dos veces', () => {
    const list = zergBase({
      tacticalCardIds: ['zerg.tactical.hydralisk_den'],
      entries: [
        entry('zerg.entry.hydralisk', '2', [
          { upgradeId: 'lurking', modelIndex: null },
          { upgradeId: 'lurking', modelIndex: null },
        ]),
      ],
    });
    expect(rules(list)).toContain('R9');
  });

  it('el coste de la mejora depende de la composición (H3)', () => {
    const cost = (compositionId: string) =>
      validateList(
        zergBase({
          tacticalCardIds: ['zerg.tactical.hydralisk_den'],
          entries: [
            entry('zerg.entry.hydralisk', compositionId, [
              { upgradeId: 'grooved_spines', modelIndex: null },
            ]),
          ],
        }),
        zerg,
      ).summary.mineralsSpent;

    expect(cost('2')).toBe(140 + 20);
    expect(cost('4')).toBe(260 + 40);
  });
});

describe('R10 — unidades invocadas', () => {
  it('no cuestan minerales ni ocupan espacios cuando son referencia', () => {
    const list = zergBase({
      entries: [entry('zerg.entry.roachling', '3', [], true)],
    });
    const summary = validateList(list, zerg).summary;
    expect(summary.mineralsSpent).toBe(0);
    expect(summary.slots.CORE.used).toBe(0);
    expect(rules(list)).not.toContain('R10');
  });

  it('da error si se intentan reclutar como unidad normal', () => {
    const list = zergBase({
      entries: [entry('zerg.entry.roachling', '3', [], false)],
    });
    expect(rules(list)).toContain('R10');
  });
});

describe('R11 — Creep Card obligatoria (solo Zerg)', () => {
  it('da error si no hay ninguna', () => {
    expect(rules(zergBase({ creepCardId: null }))).toContain('R11');
  });

  it('acepta exactamente una', () => {
    expect(rules(zergBase())).not.toContain('R11');
  });

  it('la Creep Card gratuita no consume gas', () => {
    const list = zergBase({ creepCardId: 'zerg.creep.accelerating_creep' });
    expect(validateList(list, zerg).summary.vespeneSpent).toBe(0);
  });

  it('no aplica a Terran', () => {
    const list = emptyList({
      race: 'TERRAN',
      factionCardId: 'terran.faction.terran_armed_forces',
      missionCardIds: ['mission.frontlines.standard', 'mission.supply_drop.standard'],
      deploymentCardIds: ['deployment.gauntlet', 'deployment.typhoon'],
    });
    expect(rules(list, terran)).not.toContain('R11');
  });
});

describe('R12/R13 — cartas de escenario', () => {
  it('exige exactamente 2 misiones', () => {
    expect(rules(zergBase({ missionCardIds: [] }))).toContain('R12');
    expect(
      rules(zergBase({ missionCardIds: ['mission.frontlines.standard'] })),
    ).toContain('R12');
  });

  it('prohíbe duplicados en el propio conjunto', () => {
    const list = zergBase({
      missionCardIds: [
        'mission.frontlines.standard',
        'mission.frontlines.standard',
      ],
    });
    expect(rules(list)).toContain('R12');
  });

  it('avisa, sin dar error, si la escala no coincide', () => {
    const list = zergBase({
      scaleId: 'standard',
      missionCardIds: [
        'mission.frontlines.skirmish',
        'mission.supply_drop.standard',
      ],
    });
    const result = validateList(list, zerg);
    expect(result.errors.map((e) => e.rule)).not.toContain('R13');
    expect(result.warnings.map((w) => w.rule)).toContain('R13');
  });
});

describe('Filtrado en dos niveles (SDD §6.6)', () => {
  it('oculta lo imposible y muestra lo bloqueado por recursos', () => {
    const list = zergBase({
      mineralLimit: 200,
      tacticalCardIds: ['zerg.tactical.hydralisk_den'],
    });
    const units = getEligibleUnits(list, zerg);

    // Imposible: etiqueta que la facción no tiene.
    expect(
      units.find((u) => u.entry.id === 'zerg.entry.kerrigan_swarm_raptor')?.status,
    ).toBe('impossible');

    // Bloqueado: es legal, pero no hay minerales. Debe verse en pantalla.
    const corpser = units.find((u) => u.entry.id === 'zerg.entry.corpser');
    expect(corpser?.status).toBe('blocked');
    expect(corpser?.reason?.es).toContain('240');
  });

  it('lo bloqueado por espacios explica qué carta lo resuelve', () => {
    const list = zergBase({ mineralLimit: 2000 });
    const units = getEligibleUnits(list, zerg);
    const hydra = units.find((u) => u.entry.id === 'zerg.entry.hydralisk');
    // Zerg Swarm da 1 Élite: la composición de 2 (suministro 2) no cabe.
    const comp2 = hydra?.compositions.find((c) => c.composition.id === '2');
    expect(comp2?.status).toBe('blocked');
    expect(comp2?.remedy?.es).toContain('Élite');
  });
});
