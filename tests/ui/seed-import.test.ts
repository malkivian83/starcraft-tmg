import { describe, expect, it } from 'vitest';
import { encodeSeed } from '@/engine/seed/codec';
import { decodeSeedForAnyRace } from '@/ui/common/seedImport';
import { indexFor, manualExampleList } from '../fixtures';

describe('importación de seeds desde enlaces', () => {
  it('detecta automáticamente la raza codificada en el seed', () => {
    const list = manualExampleList();
    const seed = encodeSeed(list, indexFor(list.race));
    const result = decodeSeedForAnyRace(seed);

    expect(result?.list?.race).toBe('TERRAN');
    expect(result?.list?.factionCardId).toBe(list.factionCardId);
  });
});
