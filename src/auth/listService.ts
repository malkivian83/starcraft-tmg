import type { ArmyList } from '@/engine/types';
import { ApiError } from './authService';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

export interface RemoteList extends ArmyList {
  revision: number;
  remoteUpdatedAt: string;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'No se puede conectar con el servidor de la aplicación.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new ApiError(response.status, payload?.error?.message ?? 'No se pudo completar la solicitud.');
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

export async function loadRemoteLists(): Promise<RemoteList[]> {
  return (await request<{ lists: RemoteList[] }>('/lists')).lists;
}

export async function deleteRemoteList(id: string): Promise<void> {
  await request(`/lists/${id}`, { method: 'DELETE' });
}
