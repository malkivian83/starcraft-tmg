import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, statisticsAvailable } from '@/App';
import type { AuthenticatedUser } from '@/auth/authService';
import { useAuthStore } from '@/store/authStore';
import { useListStore } from '@/store/listStore';

const user: AuthenticatedUser = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'player@example.com',
  emailVerified: true,
  authProvider: 'PASSWORD',
  locale: 'es',
  defaultRace: 'ZERG',
  nickname: null,
  avatar: null,
};

function renderBuilder(): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/nueva-lista']}>
      <App />
    </MemoryRouter>,
  );
}

describe('pestaña de estadísticas del constructor', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      location: { pathname: '/nueva-lista' },
      history: { pushState: vi.fn(), replaceState: vi.fn() },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    useAuthStore.setState({ status: 'anonymous', user: null });
    useListStore.getState().resetForRace('ZERG');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no muestra estadísticas en modo invitado', () => {
    expect(renderBuilder()).not.toContain('Estadísticas');
  });

  it('no muestra estadísticas si la lista no tiene revisión remota', () => {
    useAuthStore.getState().setUser(user);
    useListStore.setState({ remoteRevision: null });
    expect(statisticsAvailable('account', useListStore.getState().remoteRevision)).toBe(false);
  });

  it('muestra estadísticas para una lista guardada y autenticada', () => {
    useAuthStore.getState().setUser(user);
    useListStore.getState().setRemoteRevision(3);
    expect(statisticsAvailable('account', useListStore.getState().remoteRevision)).toBe(true);
    expect(statisticsAvailable('guest', 3)).toBe(false);
  });
});
