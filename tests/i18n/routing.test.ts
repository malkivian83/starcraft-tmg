import { describe, expect, it } from 'vitest';
import { findPublicListId, localizedPath, pageFromPath } from '@/i18n/routing';

describe('rutas localizadas', () => {
  it('mapea las páginas principales en ambos idiomas', () => {
    expect(pageFromPath('/es/perfil')).toBe('profile');
    expect(pageFromPath('/en/profile')).toBe('profile');
    expect(pageFromPath('/es/listas-publicas')).toBe('public-lists');
    expect(pageFromPath('/en/public-lists')).toBe('public-lists');
    expect(pageFromPath('/es/registro')).toBe('register');
    expect(pageFromPath('/en/register')).toBe('register');
    expect(pageFromPath('/es/revisa-tu-correo')).toBe('check-email');
    expect(pageFromPath('/en/check-your-email')).toBe('check-email');
  });

  it('conserva el identificador de una lista pública', () => {
    expect(localizedPath('public-list', 'en', 'abc')).toBe('/en/public-lists/abc');
    expect(localizedPath('register', 'es')).toBe('/es/registro');
    expect(localizedPath('register', 'en')).toBe('/en/register');
    expect(localizedPath('check-email', 'es')).toBe('/es/revisa-tu-correo');
    expect(localizedPath('check-email', 'en')).toBe('/en/check-your-email');
    expect(findPublicListId('/es/listas-publicas/abc')).toBe('abc');
  });

  it('mantiene alias antiguos para resolver la página', () => {
    expect(pageFromPath('/mis-listas')).toBe('lists');
    expect(pageFromPath('/perfil')).toBe('profile');
  });
});
