import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuthModeTabs } from '@/ui/auth/AuthGate';

describe('pestañas del acceso', () => {
  it('mantiene visibles las dos opciones al iniciar sesión', () => {
    const html = renderToStaticMarkup(
      <AuthModeTabs mode="login" onSelect={() => undefined} loginLabel="Iniciar sesión" registerLabel="Crear cuenta" accessModeLabel="Tipo de acceso" disabled={false} />,
    );

    expect(html).toContain('Iniciar sesión');
    expect(html).toContain('Crear cuenta');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
  });

  it('mantiene visibles las dos opciones al crear una cuenta', () => {
    const html = renderToStaticMarkup(
      <AuthModeTabs mode="register" onSelect={() => undefined} loginLabel="Iniciar sesión" registerLabel="Crear cuenta" accessModeLabel="Tipo de acceso" disabled={false} />,
    );

    expect(html).toContain('Iniciar sesión');
    expect(html).toContain('Crear cuenta');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('aria-selected="false"');
  });
});
