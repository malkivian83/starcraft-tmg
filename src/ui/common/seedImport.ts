import { loadCatalog } from '@/catalog/loader';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import { decodeSeed, type SeedDecodeResult } from '@/engine/seed/codec';
import type { Race } from '@/engine/types';

/** Intenta importar un seed con el catálogo de cada raza hasta encontrar el suyo. */
export function decodeSeedForAnyRace(seed: string): SeedDecodeResult | null {
  for (const race of ['ZERG', 'TERRAN', 'PROTOSS'] as Race[]) {
    try {
      const result = decodeSeed(seed, buildCatalogIndex(loadCatalog(race).catalog));
      if (result.list && result.status !== 'corrupt' && result.list.race === race) return result;
    } catch {
      // El seed puede no corresponder a esta raza; se prueba el siguiente catálogo.
    }
  }
  return null;
}
