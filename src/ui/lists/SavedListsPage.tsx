import { useEffect, useState } from 'react';
import { deleteRemoteList, loadRemoteLists, type RemoteList } from '@/auth/listService';
import { loadCatalog } from '@/catalog/loader';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import { computeCosts } from '@/engine/costing';
import { SLOT_TYPES } from '@/engine/types';
import type { ArmyList } from '@/engine/types';
import { slotLabel } from '../common/Chips';

export function SavedListsPage({ onCreate, onLoad }: { onCreate: () => void; onLoad: (list: ArmyList, revision: number) => void }) {
  const [lists, setLists] = useState<RemoteList[]>([]);
  const [message, setMessage] = useState('Cargando listas…');
  const refresh = async () => {
    try { const loaded = await loadRemoteLists(); setLists(loaded); setMessage(loaded.length ? '' : 'Todavía no has guardado ninguna lista.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudieron cargar las listas.'); }
  };
  useEffect(() => { void refresh(); }, []);
  const remove = async (list: RemoteList) => {
    if (!window.confirm(`¿Borrar “${list.name}”? Esta acción no se puede deshacer.`)) return;
    try { await deleteRemoteList(list.id); await refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'No se pudo borrar la lista.'); }
  };
  return <main className="content page-content no-print">
    <section className="page-heading"><div><p className="eyebrow">Biblioteca</p><h1>Mis listas</h1><p className="muted">Todas tus listas guardadas se sincronizan con tu cuenta.</p></div><button onClick={onCreate}>Crear lista</button></section>
    {message && <section className="panel empty">{message}</section>}
    <section className="saved-list-grid">{lists.map((list) => <SavedListCard key={list.id} list={list} onLoad={onLoad} onRemove={remove} />)}</section>
  </main>;
}

function SavedListCard({ list, onLoad, onRemove }: { list: RemoteList; onLoad: (list: ArmyList, revision: number) => void; onRemove: (list: RemoteList) => Promise<void> }) {
  const index = buildCatalogIndex(loadCatalog(list.race).catalog);
  const summary = computeCosts(list, index);
  const faction = list.factionCardId ? index.factionCards.get(list.factionCardId) : undefined;
  const assignedSlots = SLOT_TYPES
    .filter((type) => summary.slots[type].total > 0 || summary.slots[type].used > 0)
    .map((type) => `${slotLabel(type)} ${summary.slots[type].used}/${summary.slots[type].total}`)
    .join(' · ');

  return <article className="panel saved-list-card">
    <div>
      <div className="saved-list-card__head">
        <div><span className="chip">{list.race}</span><h2>{list.name}</h2></div>
        <img className="saved-list-card__faction-logo" src={`/factions/${list.race.toLowerCase()}.png`} alt={`Emblema ${list.race}`} />
      </div>
      <p className="saved-list-card__faction"><strong>Facción:</strong> {faction?.name ?? 'Sin seleccionar'}</p>
      <p className="saved-list-card__costs"><strong>Gastado:</strong> {summary.mineralsSpent}/{summary.mineralLimit} min. · {summary.vespeneSpent}/{summary.vespeneLimit} gas</p>
      <p className="saved-list-card__slots"><strong>Espacios:</strong> {assignedSlots || 'Sin asignar'}</p>
      <p className="muted small">Actualizada {new Date(list.remoteUpdatedAt).toLocaleString()}</p>
    </div>
    <div className="row"><button onClick={() => onLoad(list, list.revision)}>Abrir</button><button onClick={() => { void onRemove(list); }}>Borrar</button></div>
  </article>;
}
