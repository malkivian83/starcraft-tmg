import type { MatchSummary } from '@/auth/listService';

export function winRatePercent(summary: MatchSummary): number | null {
  return summary.played === 0 ? null : Math.round((summary.wins / summary.played) * 100);
}
