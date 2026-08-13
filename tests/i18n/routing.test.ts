import { describe, expect, it } from 'vitest';
import { findPublicListId, localizedPath, pageFromPath } from '@/i18n/routing';

describe('rutas localizadas', () => {
  it('mapea las páginas principales en ambos idiomas', () => {
    expect(pageFromPath('/es/perfil')).toBe('profile');
    expect(pageFromPath('/en/profile')).toBe('profile');
    expect(pageFromPath('/es/listas-publicas')).toBe('public-lists');
    expect(pageFromPath('/en/public-lists')).toBe('public-lists');
  });

  it('conserva el identificador de una lista pública', () => {
    expect(localizedPath('public-list', 'en', 'abc')).toBe('/en/public-lists/abc');
    expect(findPublicListId('/es/listas-publicas/abc')).toBe('abc');
  });

  it('mantiene alias antiguos para resolver la página', () => {
    expect(pageFromPath('/mis-listas')).toBe('lists');
    expect(pageFromPath('/perfil')).toBe('profile');
  });
});
