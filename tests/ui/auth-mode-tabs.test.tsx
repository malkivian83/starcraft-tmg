import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthModeTabs } from '@/ui/auth/AuthGate';

describe('pestañas del acceso', () => {
  it('mantiene visibles las dos opciones al iniciar sesión', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><AuthModeTabs mode="login" locale="es" loginLabel="Iniciar sesión" registerLabel="Crear cuenta" accessModeLabel="Tipo de acceso" disabled={false} /></MemoryRouter>,
    );

    expect(html).toContain('Iniciar sesión');
    expect(html).toContain('Crear cuenta');
    expect(html).toContain('href="/es/inicio"');
    expect(html).toContain('href="/es/registro"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
  });

  it('mantiene visibles las dos opciones al crear una cuenta', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter><AuthModeTabs mode="register" locale="es" loginLabel="Iniciar sesión" registerLabel="Crear cuenta" accessModeLabel="Tipo de acceso" disabled={false} /></MemoryRouter>,
    );

    expect(html).toContain('Iniciar sesión');
    expect(html).toContain('Crear cuenta');
    expect(html).toContain('href="/es/inicio"');
    expect(html).toContain('href="/es/registro"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
  });
});
