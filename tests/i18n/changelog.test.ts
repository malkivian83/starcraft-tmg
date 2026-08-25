import packageJson from '../../package.json';
import { describe, expect, it } from 'vitest';
import { CHANGELOG_ENTRIES } from '@/content/changelog';

describe('changelog visible', () => {
  it('empieza por la versión publicada de la aplicación', () => {
    expect(CHANGELOG_ENTRIES[0]?.version).toBe(packageJson.version);
  });

  it('contiene únicamente resúmenes útiles para usuarios en ambos idiomas', () => {
    const technicalTerms = /\b(API|SQL|TypeScript|React|CSS|endpoint|schema|migration|backend|frontend)\b/i;

    for (const entry of CHANGELOG_ENTRIES) {
      expect(entry.changes.length).toBeGreaterThan(0);
      for (const locale of ['es', 'en'] as const) {
        expect(entry.title[locale].trim()).not.toBe('');
        for (const change of entry.changes) {
          expect(change[locale].trim()).not.toBe('');
          expect(change[locale]).not.toMatch(technicalTerms);
        }
      }
    }
  });
});
