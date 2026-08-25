import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { PrintSheet } from '@/ui/print/PrintSheet';
import { computeCosts } from '@/engine/costing';
import { validateList } from '@/engine/validate';
import { createEmptyList, useListStore } from '@/store/listStore';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import { loadCatalog } from '@/catalog/loader';
import { supplyBandsForModels } from '@/ui/common/SupplyBands';

const index = buildCatalogIndex(loadCatalog('ZERG').catalog);

function entry(instanceId: string, unitEntryId: string, compositionId: string) {
  return {
    instanceId,
    unitEntryId,
    compositionId,
    upgrades: [],
    reference: false,
  };
}

describe('orden de unidades', () => {
  beforeEach(() => {
    useListStore.getState().resetForRace('ZERG');
  });

  it('permite mover unidades arriba y abajo sin perder sus datos', () => {
    const list = createEmptyList('ZERG');
    list.entries = [
      entry('first', 'zerg.entry.zergling', '12'),
      entry('second', 'zerg.entry.roach', '3'),
      entry('third', 'zerg.entry.zergling', '18'),
    ];
    useListStore.getState().setList(list);

    const { moveUnit } = useListStore.getState();
    moveUnit('third', 'up');
    moveUnit('third', 'up');

    expect(useListStore.getState().list.entries.map((item) => item.instanceId)).toEqual([
      'third',
      'first',
      'second',
    ]);
    expect(useListStore.getState().list.entries[0]?.compositionId).toBe('18');

    moveUnit('third', 'up');
    expect(useListStore.getState().list.entries.map((item) => item.instanceId)).toEqual([
      'third',
      'first',
      'second',
    ]);
  });

  it('la hoja imprimible conserva el orden elegido', () => {
    const list = createEmptyList('ZERG');
    list.entries = [
      entry('first', 'zerg.entry.roach', '3'),
      entry('second', 'zerg.entry.zergling', '12'),
    ];
    const summary = computeCosts(list, index);
    const html = renderToStaticMarkup(
      <PrintSheet data={{ list, index, summary, validation: validateList(list, index) }} />,
    );

    expect(html.indexOf('Roach')).toBeLessThan(html.indexOf('Zergling'));
  });

  it('imprime una ficha detallada por cada copia de la misma unidad', () => {
    const list = createEmptyList('ZERG');
    list.entries = [
      entry('first', 'zerg.entry.zergling', '12'),
      entry('second', 'zerg.entry.zergling', '12'),
    ];
    const html = renderToStaticMarkup(
      <PrintSheet
        data={{
          list,
          index,
          summary: computeCosts(list, index),
          validation: validateList(list, index),
        }}
      />,
    );

    expect(html.match(/class="unitref"/g) ?? []).toHaveLength(2);
  });

  it('limita las bandas al tamaño de la composición elegida', () => {
    const bands = index.unitCards.get('zerg.card.zergling')!.supplyProfile;

    expect(supplyBandsForModels(bands, 12)).toEqual([
      { minModels: 1, maxModels: 6, supply: 0 },
      { minModels: 7, maxModels: 12, supply: 1 },
    ]);
    expect(supplyBandsForModels(bands, 18)).toEqual(bands);
  });
});
