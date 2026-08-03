import { useEffect, useMemo, useState } from 'react';
import { loadCatalog } from '@/catalog/loader';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import { loadPublicLists, setPublicListLike, type RemoteList } from '@/auth/listService';
import type { Race, ScaleId } from '@/engine/types';
import { validateList } from '@/engine/validate';
import { ListTable } from './ListTable';

type RaceFilter = 'ALL' | Race;
type ValidityFilter = 'ALL' | 'VALID' | 'INVALID';
type SortOption = 'updated-desc' | 'updated-asc' | 'likes-desc' | 'name-asc' | 'name-desc' | 'race-asc' | 'scale-asc' | 'validity';

const RACE_LABEL: Record<Race, string> = { ZERG: 'Zerg', TERRAN: 'Terran', PROTOSS: 'Protoss' };
const SCALE_LABEL: Record<ScaleId, string> = { skirmish: 'Escaramuza', standard: 'Estándar', grand_offensive: 'Gran Ofensiva' };

export function PublicListsPage({
  onViewPublic,
  onClonePublic,
}: {
  onViewPublic: (id: string) => void;
  onClonePublic: (id: string) => void;
}) {
  const [lists, setLists] = useState<RemoteList[]>([]);
  const [message, setMessage] = useState('Cargando listas públicas…');
  const [search, setSearch] = useState('');
  const [raceFilter, setRaceFilter] = useState<RaceFilter>('ALL');
  const [scaleFilter, setScaleFilter] = useState<ScaleId | 'ALL'>('ALL');
  const [validityFilter, setValidityFilter] = useState<ValidityFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('updated-desc');

  useEffect(() => {
    let active = true;
    void loadPublicLists()
      .then((loaded) => {
        if (!active) return;
        setLists(loaded);
        setMessage(loaded.length ? '' : 'Todavía no hay listas públicas.');
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : 'No se pudieron cargar las listas públicas.');
      });
    return () => { active = false; };
  }, []);

  const handleLike = async (id: string, liked: boolean) => {
    try {
      const updated = await setPublicListLike(id, !liked);
      setLists((current) => current.map((list) => list.id === id ? updated : list));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el me gusta.');
    }
  };

  const validityById = useMemo(() => new Map(lists.map((list) => [list.id, isListValid(list)])), [lists]);
  const visibleLists = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    const filtered = lists.filter((list) => {
      if (query && !`${list.name} ${list.ownerNickname ?? ''} ${RACE_LABEL[list.race]} ${SCALE_LABEL[list.scaleId]}`.toLocaleLowerCase('es').includes(query)) return false;
      if (raceFilter !== 'ALL' && list.race !== raceFilter) return false;
      if (scaleFilter !== 'ALL' && list.scaleId !== scaleFilter) return false;
      if (validityFilter !== 'ALL' && validityById.get(list.id) !== (validityFilter === 'VALID')) return false;
      return true;
    });
    return filtered.sort((a, b) => compareLists(a, b, sortBy, validityById));
  }, [lists, raceFilter, scaleFilter, validityFilter, sortBy, search, validityById]);

  const clearFilters = () => {
    setSearch('');
    setRaceFilter('ALL');
    setScaleFilter('ALL');
    setValidityFilter('ALL');
    setSortBy('updated-desc');
  };

  return (
    <main className="content page-content no-print">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Biblioteca</p>
          <h1>Listas públicas</h1>
          <p className="muted">Explora, consulta y clona listas compartidas por la comunidad.</p>
        </div>
      </section>

      {message && <section className="panel empty">{message}</section>}

      {lists.length > 0 && (
        <section className="panel saved-list-filters public-list-filters" aria-label="Búsqueda, filtros y ordenación de listas públicas">
          <label className="field public-list-filters__search">
            Buscar
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o creador" />
          </label>
          <label className="field">Raza<select value={raceFilter} onChange={(event) => setRaceFilter(event.target.value as RaceFilter)}><option value="ALL">Todas</option><option value="ZERG">Zerg</option><option value="TERRAN">Terran</option><option value="PROTOSS">Protoss</option></select></label>
          <label className="field">Escala<select value={scaleFilter} onChange={(event) => setScaleFilter(event.target.value as ScaleId | 'ALL')}><option value="ALL">Todas</option><option value="skirmish">Escaramuza</option><option value="standard">Estándar</option><option value="grand_offensive">Gran Ofensiva</option></select></label>
          <label className="field">Validez<select value={validityFilter} onChange={(event) => setValidityFilter(event.target.value as ValidityFilter)}><option value="ALL">Todas</option><option value="VALID">Válidas</option><option value="INVALID">No válidas</option></select></label>
          <label className="field">Ordenar por<select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}><option value="updated-desc">Más recientes</option><option value="likes-desc">Más valoradas</option><option value="updated-asc">Más antiguas</option><option value="name-asc">Nombre A-Z</option><option value="name-desc">Nombre Z-A</option><option value="race-asc">Raza</option><option value="scale-asc">Escala</option><option value="validity">Validez</option></select></label>
          <div className="saved-list-filters__summary"><span className="muted small">{visibleLists.length} de {lists.length} listas</span>{(search || raceFilter !== 'ALL' || scaleFilter !== 'ALL' || validityFilter !== 'ALL' || sortBy !== 'updated-desc') && <button type="button" className="button-link button-link--compact" onClick={clearFilters}>Limpiar filtros</button>}</div>
        </section>
      )}

      {lists.length > 0 && visibleLists.length === 0 && <section className="panel empty">No hay listas públicas que coincidan con la búsqueda.</section>}
      <ListTable lists={visibleLists} onViewPublic={onViewPublic} onClonePublic={onClonePublic} onLikePublic={handleLike} showCreator showVisibility={false} />
    </main>
  );
}

function isListValid(list: RemoteList): boolean {
  const index = buildCatalogIndex(loadCatalog(list.race).catalog);
  return validateList(list, index).legal;
}

function compareLists(a: RemoteList, b: RemoteList, sortBy: SortOption, validityById: Map<string, boolean>): number {
  let comparison = 0;
  switch (sortBy) {
    case 'updated-desc': comparison = b.remoteUpdatedAt.localeCompare(a.remoteUpdatedAt); break;
    case 'updated-asc': comparison = a.remoteUpdatedAt.localeCompare(b.remoteUpdatedAt); break;
    case 'likes-desc': comparison = b.likeCount - a.likeCount; break;
    case 'name-asc': comparison = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }); break;
    case 'name-desc': comparison = b.name.localeCompare(a.name, 'es', { sensitivity: 'base' }); break;
    case 'race-asc': comparison = RACE_LABEL[a.race].localeCompare(RACE_LABEL[b.race], 'es'); break;
    case 'scale-asc': comparison = SCALE_LABEL[a.scaleId].localeCompare(SCALE_LABEL[b.scaleId], 'es'); break;
    case 'validity': comparison = Number(validityById.get(b.id)) - Number(validityById.get(a.id)); break;
  }
  return comparison || a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
}
