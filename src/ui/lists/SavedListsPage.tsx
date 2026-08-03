import { useEffect, useMemo, useState } from 'react';
import { deleteRemoteList, loadRemoteLists, type RemoteList } from '@/auth/listService';
import { loadCatalog } from '@/catalog/loader';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import { computeCosts } from '@/engine/costing';
import type { ArmyList, Race, ScaleId } from '@/engine/types';
import { SLOT_TYPES } from '@/engine/types';
import { validateList } from '@/engine/validate';
import { slotLabel } from '../common/Chips';

type RaceFilter = 'ALL' | Race;
type ValidityFilter = 'ALL' | 'VALID' | 'INVALID';
type SortOption =
  | 'updated-desc'
  | 'updated-asc'
  | 'name-asc'
  | 'name-desc'
  | 'race-asc'
  | 'scale-asc'
  | 'validity';

const RACE_LABEL: Record<Race, string> = {
  ZERG: 'Zerg',
  TERRAN: 'Terran',
  PROTOSS: 'Protoss',
};

const SCALE_LABEL: Record<ScaleId, string> = {
  skirmish: 'Escaramuza',
  standard: 'Estándar',
  grand_offensive: 'Gran Ofensiva',
};

interface SavedListRow {
  list: RemoteList;
  factionName: string;
  scaleName: string;
  legal: boolean;
  errorCount: number;
  assignedSlots: string;
  summary: ReturnType<typeof computeCosts>;
}

export function SavedListsPage({
  onCreate,
  onLoad,
}: {
  onCreate: () => void;
  onLoad: (list: ArmyList, revision: number) => void;
}) {
  const [lists, setLists] = useState<RemoteList[]>([]);
  const [message, setMessage] = useState('Cargando listas…');
  const [raceFilter, setRaceFilter] = useState<RaceFilter>('ALL');
  const [scaleFilter, setScaleFilter] = useState<ScaleId | 'ALL'>('ALL');
  const [validityFilter, setValidityFilter] = useState<ValidityFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('updated-desc');

  const refresh = async () => {
    try {
      const loaded = await loadRemoteLists();
      setLists(loaded);
      setMessage(loaded.length ? '' : 'Todavía no has guardado ninguna lista.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudieron cargar las listas.');
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const rows = useMemo(() => lists.map(toSavedListRow), [lists]);
  const visibleRows = useMemo(() => {
    const filtered = rows.filter((row) => {
      if (raceFilter !== 'ALL' && row.list.race !== raceFilter) return false;
      if (scaleFilter !== 'ALL' && row.list.scaleId !== scaleFilter) return false;
      if (validityFilter === 'VALID' && !row.legal) return false;
      if (validityFilter === 'INVALID' && row.legal) return false;
      return true;
    });

    return filtered.sort((a, b) => compareRows(a, b, sortBy));
  }, [raceFilter, rows, scaleFilter, sortBy, validityFilter]);

  const remove = async (list: RemoteList) => {
    if (!window.confirm(`¿Borrar “${list.name}”? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteRemoteList(list.id);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'No se pudo borrar la lista.');
    }
  };

  const clearFilters = () => {
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
          <h1>Mis listas</h1>
          <p className="muted">Todas tus listas guardadas se sincronizan con tu cuenta.</p>
        </div>
        <button onClick={onCreate}>Crear lista</button>
      </section>

      {message && <section className="panel empty">{message}</section>}

      {lists.length > 0 && (
        <section className="panel saved-list-filters" aria-label="Filtros y ordenación de listas">
          <label className="field">
            Raza
            <select value={raceFilter} onChange={(event) => setRaceFilter(event.target.value as RaceFilter)}>
              <option value="ALL">Todas</option>
              <option value="ZERG">Zerg</option>
              <option value="TERRAN">Terran</option>
              <option value="PROTOSS">Protoss</option>
            </select>
          </label>
          <label className="field">
            Escala
            <select value={scaleFilter} onChange={(event) => setScaleFilter(event.target.value as ScaleId | 'ALL')}>
              <option value="ALL">Todas</option>
              <option value="skirmish">Escaramuza</option>
              <option value="standard">Estándar</option>
              <option value="grand_offensive">Gran Ofensiva</option>
            </select>
          </label>
          <label className="field">
            Validez
            <select value={validityFilter} onChange={(event) => setValidityFilter(event.target.value as ValidityFilter)}>
              <option value="ALL">Todas</option>
              <option value="VALID">Válidas</option>
              <option value="INVALID">No válidas</option>
            </select>
          </label>
          <label className="field">
            Ordenar por
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
              <option value="updated-desc">Más recientes</option>
              <option value="updated-asc">Más antiguas</option>
              <option value="name-asc">Nombre A-Z</option>
              <option value="name-desc">Nombre Z-A</option>
              <option value="race-asc">Raza</option>
              <option value="scale-asc">Escala</option>
              <option value="validity">Validez</option>
            </select>
          </label>
          <div className="saved-list-filters__summary">
            <span className="muted small">{visibleRows.length} de {rows.length} listas</span>
            {(raceFilter !== 'ALL' || scaleFilter !== 'ALL' || validityFilter !== 'ALL' || sortBy !== 'updated-desc') && (
              <button type="button" className="button-link button-link--compact" onClick={clearFilters}>Limpiar filtros</button>
            )}
          </div>
        </section>
      )}

      {lists.length > 0 && visibleRows.length === 0 && (
        <section className="panel empty">No hay listas que coincidan con los filtros seleccionados.</section>
      )}

      {visibleRows.length > 0 && (
        <section className="panel saved-list-table-wrap">
          <table className="saved-list-table">
            <thead>
              <tr>
                <th scope="col">Lista</th>
                <th scope="col">Raza</th>
                <th scope="col">Escala</th>
                <th scope="col">Validez</th>
                <th scope="col">Coste</th>
                <th scope="col">Actualizada</th>
                <th scope="col"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => (
                <tr key={row.list.id}>
                  <td>
                    <div className="saved-list-table__identity">
                      <img
                        className="saved-list-table__logo"
                        src={`/factions/${row.list.race.toLowerCase()}.png`}
                        alt={`Emblema ${RACE_LABEL[row.list.race]}`}
                      />
                      <div>
                        <strong>{row.list.name}</strong>
                        <span>{row.factionName}</span>
                        <small>{row.assignedSlots || 'Sin espacios asignados'}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className="chip">{RACE_LABEL[row.list.race]}</span></td>
                  <td>{row.scaleName}</td>
                  <td>
                    <span className={`list-status ${row.legal ? 'list-status--valid' : 'list-status--invalid'}`}>
                      {row.legal ? 'Válida' : `No válida · ${row.errorCount}`}
                    </span>
                  </td>
                  <td>
                    <span className="saved-list-table__cost">{row.summary.mineralsSpent}/{row.summary.mineralLimit} min.</span>
                    <span className="saved-list-table__cost">{row.summary.vespeneSpent}/{row.summary.vespeneLimit} gas</span>
                  </td>
                  <td><time dateTime={row.list.remoteUpdatedAt}>{new Date(row.list.remoteUpdatedAt).toLocaleString()}</time></td>
                  <td>
                    <div className="row saved-list-table__actions">
                      <button type="button" onClick={() => onLoad(row.list, row.list.revision)}>Abrir</button>
                      <button type="button" onClick={() => { void remove(row.list); }}>Borrar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}

function toSavedListRow(list: RemoteList): SavedListRow {
  const index = buildCatalogIndex(loadCatalog(list.race).catalog);
  const summary = computeCosts(list, index);
  const validation = validateList(list, index);
  const faction = list.factionCardId ? index.factionCards.get(list.factionCardId) : undefined;
  const assignedSlots = SLOT_TYPES
    .filter((type) => summary.slots[type].total > 0 || summary.slots[type].used > 0)
    .map((type) => `${slotLabel(type)} ${summary.slots[type].used}/${summary.slots[type].total}`)
    .join(' · ');

  return {
    list,
    factionName: faction?.name ?? 'Sin seleccionar',
    scaleName: SCALE_LABEL[list.scaleId],
    legal: validation.legal,
    errorCount: validation.errors.length,
    assignedSlots,
    summary,
  };
}

function compareRows(a: SavedListRow, b: SavedListRow, sortBy: SortOption): number {
  let comparison = 0;
  switch (sortBy) {
    case 'updated-desc':
      comparison = b.list.remoteUpdatedAt.localeCompare(a.list.remoteUpdatedAt);
      break;
    case 'updated-asc':
      comparison = a.list.remoteUpdatedAt.localeCompare(b.list.remoteUpdatedAt);
      break;
    case 'name-asc':
      comparison = a.list.name.localeCompare(b.list.name, 'es', { sensitivity: 'base' });
      break;
    case 'name-desc':
      comparison = b.list.name.localeCompare(a.list.name, 'es', { sensitivity: 'base' });
      break;
    case 'race-asc':
      comparison = RACE_LABEL[a.list.race].localeCompare(RACE_LABEL[b.list.race], 'es');
      break;
    case 'scale-asc':
      comparison = a.scaleName.localeCompare(b.scaleName, 'es');
      break;
    case 'validity':
      comparison = Number(b.legal) - Number(a.legal);
      break;
  }
  return comparison || a.list.name.localeCompare(b.list.name, 'es', { sensitivity: 'base' });
}
