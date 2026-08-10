import type { MatchRecord } from '@/auth/listService';
import type { Race } from '@/engine/types';

export type MatchGroupId = Race | 'UNKNOWN';

export interface MatchGroup {
  id: MatchGroupId;
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export const OPPONENT_RACE_ORDER: MatchGroupId[] = ['ZERG', 'TERRAN', 'PROTOSS', 'UNKNOWN'];

export const DONUT_RADIUS = 40;
export const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;
export const DONUT_GAP = 2;

export interface DonutSegment {
  key: 'wins' | 'losses' | 'draws';
  length: number;
  offset: number;
}

export function groupByOpponentRace(matches: MatchRecord[]): MatchGroup[] {
  const groups = new Map<MatchGroupId, MatchGroup>(
    OPPONENT_RACE_ORDER.map((id) => [id, { id, played: 0, wins: 0, losses: 0, draws: 0 }]),
  );

  for (const match of matches) {
    const group = groups.get(match.opponentRace ?? 'UNKNOWN')!;
    group.played += 1;
    if (match.result === 'WIN') group.wins += 1;
    else if (match.result === 'LOSS') group.losses += 1;
    else group.draws += 1;
  }

  return OPPONENT_RACE_ORDER.map((id) => groups.get(id)!).filter((group) => group.played > 0);
}

export function winRatePercent(group: { played: number; wins: number }): number | null {
  return group.played === 0 ? null : Math.round((group.wins / group.played) * 100);
}

export function donutSegments(group: MatchGroup): DonutSegment[] {
  const values: Array<{ key: DonutSegment['key']; value: number }> = [
    { key: 'wins', value: group.wins },
    { key: 'losses', value: group.losses },
    { key: 'draws', value: group.draws },
  ];
  const active = values.filter(({ value }) => value > 0);
  if (active.length === 0 || group.played <= 0) return [];
  if (active.length === 1) return [{ key: active[0]!.key, length: DONUT_CIRCUMFERENCE, offset: 0 }];

  let accumulated = 0;
  return active.map(({ key, value }) => {
    const rawLength = DONUT_CIRCUMFERENCE * value / group.played;
    const segment = { key, length: Math.max(0, rawLength - DONUT_GAP), offset: accumulated === 0 ? 0 : -accumulated };
    accumulated += rawLength;
    return segment;
  });
}
