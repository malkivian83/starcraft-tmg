import { useEffect, useMemo, useState } from 'react';
import { setPublicListLike, type RemoteList } from '@/auth/listService';
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
  const [liked, setLiked] = useState(list.likedByCurrentUser);
  const [likeCount, setLikeCount] = useState(list.likeCount);
  const [likePending, setLikePending] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);
  useEffect(() => {
    setLiked(list.likedByCurrentUser);
    setLikeCount(list.likeCount);
  }, [list.id, list.likeCount, list.likedByCurrentUser]);

  const data = useMemo(() => {
    const index = buildCatalogIndex(loadCatalog(list.race).catalog);
    return { list, index, summary: computeCosts(list, index), validation: validateList(list, index) };
  }, [list]);

  const toggleLike = async () => {
    setLikePending(true);
    setLikeError(null);
    try {
      const updated = await setPublicListLike(list.id, !liked);
      setLiked(updated.likedByCurrentUser);
      setLikeCount(updated.likeCount);
    } catch (error) {
      setLikeError(error instanceof Error ? error.message : 'No se pudo actualizar el me gusta.');
    } finally {
      setLikePending(false);
    }
  };

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
          <button type="button" className={liked ? 'like-button like-button--active' : 'like-button'} aria-label={liked ? 'Quitar me gusta' : 'Marcar con me gusta'} aria-pressed={liked} onClick={() => { void toggleLike(); }} disabled={likePending}><span className="like-button__icon" aria-hidden="true">{liked ? '♥' : '♡'}</span><span>{likeCount}</span></button>
          <button type="button" onClick={() => window.print()}>Imprimir</button>
          <button type="button" onClick={onClone}>Clonar lista</button>
        </div>
      </div>
      {likeError && <p className="issue issue--error public-list-like-error no-print">{likeError}</p>}
      <PrintSheet data={data} />
    </main>
  );
}
