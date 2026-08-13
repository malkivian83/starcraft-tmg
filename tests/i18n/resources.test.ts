import { describe, expect, it } from 'vitest';
import { resources } from '@/i18n/locales';

function leafKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key));
}

describe('recursos de traducción', () => {
  it('mantienen las mismas claves en español e inglés', () => {
    expect(leafKeys(resources.es).sort()).toEqual(leafKeys(resources.en).sort());
  });

  it('no contienen hojas vacías', () => {
    for (const locale of ['es', 'en'] as const) {
      for (const key of leafKeys(resources[locale])) {
        const value = key.split('.').reduce<unknown>((current, segment) => (current as Record<string, unknown>)[segment], resources[locale]);
        expect(value, `${locale}.${key}`).toEqual(expect.any(String));
        expect(String(value).trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });
});
