import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decodeSeed, encodeSeed } from '@/engine/seed/codec';
import { validateList } from '@/engine/validate';
import { emptyList, entry, indexFor, manualExampleList } from '../fixtures';

const zerg = indexFor('ZERG');
const terran = indexFor('TERRAN');

/** Compara lo que define la lista, ignorando id/fechas/nombre. */
function shape(list: ReturnType<typeof emptyList>) {
  return {
    race: list.race,
    scaleId: list.scaleId,
    mineralLimit: list.mineralLimit,
    factionCardId: list.factionCardId,
    creepCardId: list.creepCardId,
    tacticalCardIds: list.tacticalCardIds,
    missionCardIds: list.missionCardIds,
    deploymentCardIds: list.deploymentCardIds,
    entries: list.entries.map((e) => ({
      unitEntryId: e.unitEntryId,
      compositionId: e.compositionId,
      reference: e.reference,
      upgrades: e.upgrades,
    })),
  };
}

describe('Formato del seed', () => {
  it('lleva prefijo y va agrupado para poder dictarse', () => {
    const seed = encodeSeed(manualExampleList(), terran);
    expect(seed.startsWith('SCT1-')).toBe(true);
    expect(seed.split('-').slice(1).every((g) => g.length <= 5)).toBe(true);
  });

  it('no usa caracteres ambiguos (I, L, O, U)', () => {
    const seed = encodeSeed(manualExampleList(), terran);
    expect(seed.slice(5)).not.toMatch(/[ILOU]/);
  });

  it('una lista estándar cabe en un código manejable', () => {
    const seed = encodeSeed(manualExampleList(), terran);
    expect(seed.length).toBeLessThan(160);
  });
});

describe('Ida y vuelta', () => {
  it('reconstruye la lista del manual sin pérdidas', () => {
    const original = manualExampleList();
    const result = decodeSeed(encodeSeed(original, terran), terran);

    expect(result.status).toBe('ok');
    expect(result.missing).toEqual([]);
    expect(shape(result.list!)).toEqual(shape(original));
  });

  it('la lista reconstruida sigue siendo legal y con las mismas cifras', () => {
    const original = manualExampleList();
    const decoded = decodeSeed(encodeSeed(original, terran), terran).list!;

    const a = validateList(original, terran).summary;
    const b = validateList(decoded, terran).summary;
    expect(b.mineralsSpent).toBe(a.mineralsSpent);
    expect(b.vespeneSpent).toBe(a.vespeneSpent);
    expect(validateList(decoded, terran).legal).toBe(true);
  });

  it('conserva la nominación de modelo de las mejoras SPECIALIST', () => {
    const original = emptyList({
      race: 'TERRAN',
      factionCardId: 'terran.faction.terran_armed_forces',
      tacticalCardIds: ['terran.tactical.barracks'],
      entries: [
        entry('terran.entry.marine', '6', [
          { upgradeId: 'agg_12', modelIndex: 3 },
          { upgradeId: 'rocket_launcher', modelIndex: 4 },
          { upgradeId: 'combat_shield', modelIndex: null },
        ]),
      ],
    });
    const decoded = decodeSeed(encodeSeed(original, terran), terran).list!;
    expect(decoded.entries[0]!.upgrades).toEqual([
      { upgradeId: 'agg_12', modelIndex: 3 },
      { upgradeId: 'rocket_launcher', modelIndex: 4 },
      { upgradeId: 'combat_shield', modelIndex: null },
    ]);
  });

  it('conserva las unidades invocadas marcadas como referencia', () => {
    const original = emptyList({
      factionCardId: 'zerg.faction.zerg_swarm',
      creepCardId: 'zerg.creep.malignant_creep',
      entries: [entry('zerg.entry.roachling', '3', [], true)],
    });
    const decoded = decodeSeed(encodeSeed(original, zerg), zerg).list!;
    expect(decoded.entries[0]!.reference).toBe(true);
    expect(decoded.creepCardId).toBe('zerg.creep.malignant_creep');
  });

  it('acepta el seed sin guiones y en minúsculas', () => {
    const original = manualExampleList();
    const seed = encodeSeed(original, terran);
    const messy = seed.replace(/-/g, '').toLowerCase();
    expect(shape(decodeSeed(messy, terran).list!)).toEqual(shape(original));
  });
});

describe('Detección de corrupción', () => {
  it('rechaza un seed truncado', () => {
    const seed = encodeSeed(manualExampleList(), terran);
    const result = decodeSeed(seed.slice(0, seed.length - 6), terran);
    expect(result.status).toBe('corrupt');
    expect(result.list).toBeNull();
  });

  it('rechaza un carácter alterado en lugar de inventar una lista', () => {
    const seed = encodeSeed(manualExampleList(), terran);
    // Altera un carácter del cuerpo por otro válido del alfabeto.
    const body = seed.slice(5).replace(/-/g, '');
    const flipped = (body[3] === 'Z' ? 'Y' : 'Z') as string;
    const mutated = `SCT1-${body.slice(0, 3)}${flipped}${body.slice(4)}`;

    const result = decodeSeed(mutated, terran);
    expect(result.status).toBe('corrupt');
  });

  it('rechaza texto arbitrario', () => {
    expect(decodeSeed('hola que tal', terran).status).toBe('corrupt');
    expect(decodeSeed('', terran).status).toBe('corrupt');
  });

  it('ninguna mutación de un carácter produce una lista DISTINTA en silencio', () => {
    // La propiedad que de verdad importa no es "toda mutación se detecta",
    // sino "ninguna mutación cuela una lista equivocada". La diferencia no es
    // teórica: los últimos bits de una cadena Base32 son relleno y no forman
    // parte de ningún byte, así que alterarlos decodifica exactamente la misma
    // lista. Eso es correcto e inofensivo — lo inaceptable sería devolver una
    // lista diferente y darla por buena.
    const original = manualExampleList();
    const seed = encodeSeed(original, terran).slice(5).replace(/-/g, '');
    const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    const expected = shape(original);

    fc.assert(
      fc.property(
        fc.nat({ max: seed.length - 1 }),
        fc.integer({ min: 0, max: 31 }),
        (position, replacement) => {
          const char = alphabet[replacement] as string;
          if (seed[position] === char) return true;

          const mutated =
            seed.slice(0, position) + char + seed.slice(position + 1);
          const result = decodeSeed(`SCT1-${mutated}`, terran);

          if (result.status === 'corrupt') return true;
          // Si no se detectó, la lista debe ser idéntica a la original.
          expect(shape(result.list!)).toEqual(expected);
          return true;
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('Propiedad: encode → decode es la identidad', () => {
  it('para listas Zerg generadas al azar', () => {
    const unitIds = zerg.catalog.unitEntries
      .filter((e) => !e.summoned)
      .map((e) => e.id);

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            unitEntryId: fc.constantFrom(...unitIds),
            pick: fc.nat({ max: 3 }),
          }),
          { maxLength: 12 },
        ),
        fc.constantFrom<'skirmish' | 'standard' | 'grand_offensive'>(
          'skirmish',
          'standard',
          'grand_offensive',
        ),
        fc.integer({ min: 100, max: 5000 }),
        (picks, scaleId, mineralLimit) => {
          const entries = picks.map((p) => {
            const unit = zerg.unitEntries.get(p.unitEntryId)!;
            const composition =
              unit.compositions[p.pick % unit.compositions.length]!;
            return entry(unit.id, composition.id);
          });

          const original = emptyList({
            scaleId,
            mineralLimit,
            factionCardId: 'zerg.faction.kerrigans_swarm',
            creepCardId: 'zerg.creep.malignant_creep',
            tacticalCardIds: ['zerg.tactical.lair', 'zerg.tactical.hatchery'],
            missionCardIds: [
              'mission.frontlines.standard',
              'mission.supply_drop.skirmish',
            ],
            deploymentCardIds: ['deployment.breach', 'deployment.frontier'],
            entries,
          });

          const decoded = decodeSeed(encodeSeed(original, zerg), zerg);
          expect(decoded.status).toBe('ok');
          expect(shape(decoded.list!)).toEqual(shape(original));
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});
