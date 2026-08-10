import { describe, expect, it } from 'vitest';
import type { MatchRecord } from '@/auth/listService';
import { DONUT_CIRCUMFERENCE, donutSegments, groupByOpponentRace, winRatePercent } from '@/ui/builder/matchStats';

function match(result: MatchRecord['result'], opponentRace: MatchRecord['opponentRace'], id = `${result}-${opponentRace ?? 'unknown'}`): MatchRecord {
  return {
    id,
    listId: 'list-1',
    result,
    playedOn: null,
    opponentRace,
    opponentFactionCardId: null,
    opponentName: null,
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
  };
}

describe('estadísticas de partidas por raza rival', () => {
  it('agrupa en orden fijo y envía la raza no registrada al grupo desconocido', () => {
    expect(groupByOpponentRace([
      match('LOSS', 'TERRAN', 'loss-terran'),
      match('WIN', 'ZERG', 'win-zerg'),
      match('DRAW', null, 'draw-unknown'),
      match('WIN', 'TERRAN', 'win-terran'),
    ])).toEqual([
      { id: 'ZERG', played: 1, wins: 1, losses: 0, draws: 0 },
      { id: 'TERRAN', played: 2, wins: 1, losses: 1, draws: 0 },
      { id: 'UNKNOWN', played: 1, wins: 0, losses: 0, draws: 1 },
    ]);
  });

  it('no devuelve grupos sin partidas y calcula el porcentaje sobre el total', () => {
    expect(groupByOpponentRace([])).toEqual([]);
    expect(winRatePercent({ played: 0, wins: 0 })).toBeNull();
    expect(winRatePercent({ played: 3, wins: 2 })).toBe(67);
  });

  it('deja el anillo continuo cuando solo existe un resultado', () => {
    const segments = donutSegments({ id: 'ZERG', played: 3, wins: 3, losses: 0, draws: 0 });
    expect(segments).toEqual([{ key: 'wins', length: DONUT_CIRCUMFERENCE, offset: 0 }]);
  });

  it('emite los sectores en orden victoria, derrota y empate con huecos', () => {
    const segments = donutSegments({ id: 'ZERG', played: 3, wins: 1, losses: 1, draws: 1 });
    expect(segments.map((segment) => segment.key)).toEqual(['wins', 'losses', 'draws']);
    expect(segments[0]!.offset).toBe(0);
    expect(segments[1]!.offset).toBeCloseTo(-DONUT_CIRCUMFERENCE / 3);
    expect(segments[0]!.length).toBeCloseTo(DONUT_CIRCUMFERENCE / 3 - 2);
  });
});
