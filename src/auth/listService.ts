import type { ArmyList, Race } from '@/engine/types';
import { ApiError, localizedApiErrorMessage } from './authService';
import i18n from '@/i18n/config';
import { apiBaseUrl } from './apiBase';

export interface RemoteList extends ArmyList {
  revision: number;
  remoteUpdatedAt: string;
  isPublic: boolean;
  publishedAt: string | null;
  ownerNickname: string | null;
  ownerAvatar: string | null;
  likeCount: number;
  likedByCurrentUser: boolean;
}

export type MatchResult = 'WIN' | 'LOSS' | 'DRAW';

export interface MatchRecord {
  id: string;
  listId: string;
  result: MatchResult;
  playedOn: string | null;
  opponentRace: Race | null;
  opponentFactionCardId: string | null;
  opponentName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchSummary {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface MatchRecordInput {
  result: MatchResult;
  playedOn: string | null;
  opponentRace: Race | null;
  opponentFactionCardId: string | null;
  opponentName: string | null;
}

export interface HomeData {
  recentLists: RemoteList[];
  publicLists: RemoteList[];
}

export interface RemoteListPage {
  lists: RemoteList[];
  nextCursor: string | null;
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError(0, i18n.language.startsWith('en')
        ? `The server did not respond within ${Math.round(timeoutMs / 1000)} seconds.`
        : `El servidor no respondiÃ³ en ${Math.round(timeoutMs / 1000)} segundos.`);
    }
    throw new ApiError(0, i18n.language.startsWith('en') ? 'The application server could not be reached.' : 'No se puede conectar con el servidor de la aplicación.');
  } finally {
    globalThis.clearTimeout(timeout);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    const code = payload?.error?.code ?? null;
    throw new ApiError(response.status, localizedApiErrorMessage(code, payload?.error?.message ?? (i18n.language.startsWith('en') ? 'The request could not be completed.' : 'No se pudo completar la solicitud.')), code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function saveRemoteList(list: ArmyList, revision: number | null): Promise<RemoteList> {
  if (revision === null) {
    return (await request<{ list: RemoteList }>('/lists', { method: 'POST', body: JSON.stringify(list) })).list;
  }
  return (await request<{ list: RemoteList }>(`/lists/${list.id}`, {
    method: 'PUT', headers: { 'If-Match': String(revision) }, body: JSON.stringify(list),
  })).list;
}

export async function loadRemoteLists(options: { cursor?: string | null; limit?: number } = {}): Promise<RemoteListPage> {
  const params = new URLSearchParams();
  if (options.limit) params.set('limit', String(options.limit));
  if (options.cursor) params.set('cursor', options.cursor);
  const query = params.toString();
  return request<RemoteListPage>(`/lists${query ? `?${query}` : ''}`);
}

export async function loadPublicLists(): Promise<RemoteList[]> {
  return (await request<{ lists: RemoteList[] }>('/lists/public')).lists;
}

export async function loadHomeData(): Promise<HomeData> {
  return request<HomeData>('/lists/home');
}

export async function loadPublicList(id: string): Promise<RemoteList> {
  return (await request<{ list: RemoteList }>(`/lists/public/${encodeURIComponent(id)}`)).list;
}

export async function clonePublicList(id: string): Promise<RemoteList> {
  return (await request<{ list: RemoteList }>(`/lists/public/${encodeURIComponent(id)}/clone`, {
    method: 'POST',
  })).list;
}

export async function setPublicListLike(id: string, liked: boolean): Promise<RemoteList> {
  return (await request<{ list: RemoteList }>(`/lists/public/${encodeURIComponent(id)}/like`, {
    method: liked ? 'POST' : 'DELETE',
  })).list;
}

export async function setListPublic(id: string, isPublic: boolean): Promise<RemoteList> {
  return (await request<{ list: RemoteList }>(`/lists/${encodeURIComponent(id)}/visibility`, {
    method: 'PUT',
    body: JSON.stringify({ isPublic }),
  })).list;
}

export async function deleteRemoteList(id: string): Promise<void> {
  await request(`/lists/${id}`, { method: 'DELETE' });
}

export async function loadListMatches(listId: string): Promise<{ matches: MatchRecord[]; summary: MatchSummary }> {
  return request(`/lists/${encodeURIComponent(listId)}/matches`);
}

export async function createListMatch(listId: string, input: MatchRecordInput): Promise<{ match: MatchRecord; summary: MatchSummary }> {
  return request(`/lists/${encodeURIComponent(listId)}/matches`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateListMatch(listId: string, matchId: string, input: MatchRecordInput): Promise<{ match: MatchRecord; summary: MatchSummary }> {
  return request(`/lists/${encodeURIComponent(listId)}/matches/${encodeURIComponent(matchId)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export async function deleteListMatch(listId: string, matchId: string): Promise<{ summary: MatchSummary }> {
  return request(`/lists/${encodeURIComponent(listId)}/matches/${encodeURIComponent(matchId)}`, {
    method: 'DELETE',
  });
}
