import { describe, expect, it } from 'vitest';
import { winRatePercent } from '@/store/matchSummary';

describe('porcentaje de victorias', () => {
  it('devuelve null si no hay partidas', () => {
    expect(winRatePercent({ played: 0, wins: 0, losses: 0, draws: 0 })).toBeNull();
  });

  it('redondea 1 victoria de 3 al entero más cercano', () => {
    expect(winRatePercent({ played: 3, wins: 1, losses: 2, draws: 0 })).toBe(33);
  });

  it('devuelve 100 para una racha perfecta', () => {
    expect(winRatePercent({ played: 3, wins: 3, losses: 0, draws: 0 })).toBe(100);
  });
});
