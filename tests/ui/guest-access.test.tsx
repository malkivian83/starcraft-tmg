import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { App, initialPageFor, pageForPathname } from '@/App';
import { useAuthStore } from '@/store/authStore';
import { useListStore } from '@/store/listStore';

describe('ruta pública del constructor', () => {
  beforeEach(() => {
    useAuthStore.setState({ status: 'anonymous', user: null });
    useListStore.getState().resetForRace('ZERG');
  });

  it('muestra únicamente las capacidades del invitado', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/crear-lista']}>
        <App />
      </MemoryRouter>,
    );

    expect(html).toContain('Modo invitado');
    expect(html).toContain('Inicia sesión para guardar');
    expect(html).toContain('Esta lista se perderá al cerrar o recargar');
    expect(html).toContain('Seed');
    expect(html).toContain('Importar');
    expect(html).toContain('Exportar');
    expect(html).toContain('Imprimir / PDF');
    expect(html).not.toContain('Mis listas');
    expect(html).not.toContain('Listas públicas');
    expect(html).not.toContain('Visibilidad');
    expect(html).not.toContain('Abrir perfil');
    expect(html).not.toContain('header-logout');
  });

  it('tiene la hoja imprimible montada desde el primer paso', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/crear-lista']}>
        <App />
      </MemoryRouter>,
    );

    expect(html).toContain('print-sheet-host');
    expect(html).toContain('class="sheet"');
    expect(html).toContain('LISTA NO VÁLIDA');
  });

  it('abre el constructor al reclamar un borrador invitado', () => {
    expect(initialPageFor('account', true, null)).toBe('builder');
    expect(initialPageFor('account', false, null)).toBe('home');
    expect(initialPageFor('account', false, 'public-list-id')).toBe('public-list');
  });

  it('restaura la sección según la ruta al recargar', () => {
    expect(pageForPathname('/')).toBe('home');
    expect(pageForPathname('/mis-listas')).toBe('lists');
    expect(pageForPathname('/listas-publicas')).toBe('public-lists');
    expect(pageForPathname('/nueva-lista')).toBe('builder');
    expect(pageForPathname('/perfil')).toBe('profile');
    expect(pageForPathname('/soporte')).toBe('support');
    expect(pageForPathname('/public-lists/id', 'id')).toBe('public-list');
  });
});
