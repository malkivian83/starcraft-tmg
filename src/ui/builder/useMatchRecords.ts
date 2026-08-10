import { useCallback, useEffect, useState } from 'react';
import {
  createListMatch,
  deleteListMatch,
  loadListMatches,
  updateListMatch,
  type MatchRecord,
  type MatchRecordInput,
  type MatchSummary,
} from '@/auth/listService';

const EMPTY_SUMMARY: MatchSummary = { played: 0, wins: 0, losses: 0, draws: 0 };

function compareMatches(a: MatchRecord, b: MatchRecord): number {
  if (a.playedOn === null && b.playedOn !== null) return 1;
  if (a.playedOn !== null && b.playedOn === null) return -1;
  if (a.playedOn !== b.playedOn) return (b.playedOn ?? '').localeCompare(a.playedOn ?? '');
  return b.createdAt.localeCompare(a.createdAt);
}

export interface MatchRecordsState {
  matches: MatchRecord[];
  summary: MatchSummary;
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  isMutating: boolean;
  create: (input: MatchRecordInput) => Promise<boolean>;
  update: (id: string, input: MatchRecordInput) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  reload: () => Promise<void>;
}

export function useMatchRecords(listId: string | null): MatchRecordsState {
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [summary, setSummary] = useState<MatchSummary>(EMPTY_SUMMARY);
  const [status, setStatus] = useState<MatchRecordsState['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const reload = useCallback(async () => {
    if (!listId) return;
    setStatus('loading');
    setError(null);
    try {
      const loaded = await loadListMatches(listId);
      setMatches(loaded.matches);
      setSummary(loaded.summary);
      setStatus('ready');
    } catch (reason) {
      setStatus('error');
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }, [listId]);

  useEffect(() => {
    let active = true;
    setMatches([]);
    setSummary(EMPTY_SUMMARY);
    setError(null);
    if (!listId) {
      setStatus('idle');
      return () => { active = false; };
    }

    setStatus('loading');
    void loadListMatches(listId)
      .then((loaded) => {
        if (!active) return;
        setMatches(loaded.matches);
        setSummary(loaded.summary);
        setStatus('ready');
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setStatus('error');
        setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => { active = false; };
  }, [listId]);

  const mutate = useCallback(async (
    operation: () => Promise<{ match: MatchRecord; summary: MatchSummary }>,
  ): Promise<boolean> => {
    setIsMutating(true);
    setError(null);
    try {
      const result = await operation();
      setMatches((current) => {
        const index = current.findIndex((match) => match.id === result.match.id);
        if (index === -1) return [result.match, ...current].sort(compareMatches);
        const next = [...current];
        next[index] = result.match;
        return next.sort(compareMatches);
      });
      setSummary(result.summary);
      setStatus('ready');
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return false;
    } finally {
      setIsMutating(false);
    }
  }, []);

  const create = useCallback((input: MatchRecordInput) => {
    if (!listId) return Promise.resolve(false);
    return mutate(() => createListMatch(listId, input));
  }, [listId, mutate]);

  const update = useCallback((id: string, input: MatchRecordInput) => {
    if (!listId) return Promise.resolve(false);
    return mutate(() => updateListMatch(listId, id, input));
  }, [listId, mutate]);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    if (!listId) return false;
    setIsMutating(true);
    setError(null);
    try {
      const result = await deleteListMatch(listId, id);
      setMatches((current) => current.filter((match) => match.id !== id));
      setSummary(result.summary);
      setStatus('ready');
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [listId]);

  return { matches, summary, status, error, isMutating, create, update, remove, reload };
}
