import { describe, expect, it } from 'vitest';
import { collectKeywordGlossary, keywordAt } from '@/ui/common/keywordGlossary';

describe('glosario interactivo de palabras clave', () => {
  it('reconoce la notación completa de IMPACT', () => {
    const text = 'resuelve el efecto IMPACT (3) 4+.';
    const start = text.indexOf('IMPACT');
    const match = keywordAt(text, start);

    expect(match?.length).toBe('IMPACT (3) 4+'.length);
    expect(match?.text.es).toContain('Carga');
  });

  it('no reconoce una palabra dentro de otro identificador', () => {
    expect(keywordAt('ANTI-EVASION', 0)).toBeNull();
    expect(keywordAt('XIMPACT', 1)).toBeNull();
  });

  it('incluye BURROWED en el glosario', () => {
    const match = keywordAt('gana BURROWED Status', 5);
    expect(match?.length).toBe('BURROWED'.length);
    expect(match?.text.es).toContain('HIDDEN');
  });

  it('reconoce BURROWED aunque aparezca con mayúscula inicial', () => {
    const text = 'tiene el estado Burrowed, resuelve HEAL';
    const start = text.indexOf('Burrowed');
    const match = keywordAt(text, start);

    expect(match?.length).toBe('Burrowed'.length);
  });

  it('agrupa las variantes de una palabra clave en una sola entrada', () => {
    const entries = collectKeywordGlossary([
      'resuelve HEAL (2)',
      'resuelve HEAL (3)',
      'tiene el estado Burrowed',
    ]);

    expect(entries.map((entry) => entry.label)).toEqual(['HEAL (2)', 'Burrowed']);
  });
});
