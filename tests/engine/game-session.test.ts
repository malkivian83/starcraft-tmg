import { describe, expect, it } from 'vitest';
import { advanceRound, createGameSession, deriveGameState, finishGame, supplyForRound, undoRound, updateVictoryPoints } from '@/engine/gameSession';
import type { MissionCard } from '@/engine/types';

const mission: MissionCard = {
  id: 'mission.test.standard',
  seedId: 1,
  name: 'Test Mission',
  scale: 'standard',
  startingSupply: 6,
  supplyEscalation: 2,
  gameLength: 5,
  missionParameters: { es: 'Parámetros', en: 'Parameters' },
  scoringConditions: { es: 'Puntuación', en: 'Scoring' },
  additionalConditions: { es: 'Condiciones', en: 'Conditions' },
  instantWinLead: 10,
};

function session() {
  return createGameSession('00000000-0000-4000-8000-000000000001', 'GUEST', {
    pointsLimit: 1500,
    mission,
    players: [{ name: 'A', race: 'ZERG' }, { name: 'B', race: 'TERRAN' }],
  }, '2026-08-22T10:00:00.000Z');
}

describe('game session rules', () => {
  it('derives mission supply and makes the final round unlimited', () => {
    expect(supplyForRound(mission, 1)).toBe(6);
    expect(supplyForRound(mission, 4)).toBe(12);
    expect(supplyForRound(mission, 5)).toBe('UNLIMITED');
  });

  it('advances and undoes only the round while preserving victory points', () => {
    const scored = updateVictoryPoints(advanceRound(session()), 1, 1);
    const undone = undoRound(scored);
    expect(undone.currentRound).toBe(1);
    expect(undone.players[0].victoryPoints).toBe(1);
    expect(deriveGameState(undone).supply).toBe(6);
  });

  it('never allows negative victory points', () => {
    const changed = updateVictoryPoints(session(), 1, -1);
    expect(changed.players[0].victoryPoints).toBe(0);
  });

  it('derives leader, margin and instant victory from the two totals', () => {
    const scored = updateVictoryPoints(updateVictoryPoints(session(), 1, 1), 1, 1);
    const state = deriveGameState(updateVictoryPoints(scored, 2, 1));
    expect(state.leader).toBe(1);
    expect(state.margin).toBe(1);
    expect(state.instantVictory).toBe(false);
  });

  it('locks the session after a confirmed result', () => {
    const finished = finishGame(session(), 1, 'ROUNDS_COMPLETE');
    expect(finished.status).toBe('FINISHED');
    expect(() => updateVictoryPoints(finished, 1, 1)).toThrow();
    expect(() => advanceRound(finished)).toThrow();
  });
});
