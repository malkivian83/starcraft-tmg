import type { GameCommand, GameSession } from '@/engine/gameSession';
import type { Race } from '@/engine/types';
import i18n from '@/i18n/config';
import { ApiError, localizedApiErrorMessage } from './authService';
import { apiBaseUrl } from './apiBase';

export interface GameCreateInput {
  pointsLimit: number;
  missionId: string;
  players: [{ name: string; race: Race }, { name: string; race: Race }];
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, i18n.language.startsWith('en') ? 'The application server could not be reached.' : 'No se puede conectar con el servidor de la aplicación.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { code?: string; message?: string } } | null;
    const code = payload?.error?.code ?? null;
    throw new ApiError(response.status, localizedApiErrorMessage(code, payload?.error?.message ?? (i18n.language.startsWith('en') ? 'The request could not be completed.' : 'No se pudo completar la solicitud.')), code);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function loadGames(): Promise<GameSession[]> {
  return (await request<{ games: GameSession[] }>('/games')).games;
}

export async function loadGuestGames(): Promise<GameSession[]> {
  return (await request<{ games: GameSession[] }>('/games/guest')).games;
}

export async function createGame(input: GameCreateInput): Promise<GameSession> {
  return (await request<{ game: GameSession }>('/games', { method: 'POST', body: JSON.stringify(input) })).game;
}

export async function loadGame(id: string): Promise<GameSession> {
  return (await request<{ game: GameSession }>(`/games/${encodeURIComponent(id)}`)).game;
}

export async function sendGameCommand(id: string, revision: number, command: GameCommand): Promise<GameSession> {
  return (await request<{ game: GameSession }>(`/games/${encodeURIComponent(id)}/commands`, {
    method: 'POST',
    headers: { 'If-Match': String(revision) },
    body: JSON.stringify(command),
  })).game;
}

export async function deleteGame(id: string): Promise<void> {
  await request<void>(`/games/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function claimGame(id: string): Promise<GameSession> {
  return (await request<{ game: GameSession }>(`/games/${encodeURIComponent(id)}/claim`, { method: 'POST' })).game;
}

export async function linkGameToList(id: string, revision: number, listId: string, ownerPlayerSlot: 1 | 2): Promise<GameSession> {
  return (await request<{ game: GameSession }>(`/games/${encodeURIComponent(id)}/link-list`, {
    method: 'POST',
    headers: { 'If-Match': String(revision) },
    body: JSON.stringify({ listId, ownerPlayerSlot }),
  })).game;
}
