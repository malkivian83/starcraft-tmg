import { useMemo } from 'react';
import type { RemoteList } from '@/auth/listService';
import { loadCatalog } from '@/catalog/loader';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import { computeCosts } from '@/engine/costing';
import { validateList } from '@/engine/validate';
import { PrintSheet } from '../print/PrintSheet';

export function PublicListPage({
  list,
  onBack,
  onClone,
}: {
  list: RemoteList;
  onBack: () => void;
  onClone: () => void;
}) {
  const data = useMemo(() => {
    const index = buildCatalogIndex(loadCatalog(list.race).catalog);
    return { list, index, summary: computeCosts(list, index), validation: validateList(list, index) };
  }, [list]);

  return (
    <main className="public-list-page">
      <div className="public-list-toolbar no-print">
        <button type="button" onClick={onBack}>← Volver</button>
        <div>
          <p className="eyebrow">Lista pública</p>
          <h1>{list.name}</h1>
          <p className="muted">Compartida por {list.ownerNickname ?? 'Usuario'} · solo lectura</p>
        </div>
        <div className="public-list-toolbar__actions">
          <button type="button" onClick={() => window.print()}>Imprimir</button>
          <button type="button" onClick={onClone}>Clonar lista</button>
        </div>
      </div>
      <PrintSheet data={data} />
    </main>
  );
}
