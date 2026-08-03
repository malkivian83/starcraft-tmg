import { useMemo } from 'react';
import { loadCatalog } from '@/catalog/loader';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import { computeCosts } from '@/engine/costing';
import type { RemoteList } from '@/auth/listService';
import type { Race, ScaleId } from '@/engine/types';
import { SLOT_TYPES } from '@/engine/types';
import { validateList } from '@/engine/validate';
import { slotLabel } from '../common/Chips';

const RACE_LABEL: Record<Race, string> = { ZERG: 'Zerg', TERRAN: 'Terran', PROTOSS: 'Protoss' };
const SCALE_LABEL: Record<ScaleId, string> = {
  skirmish: 'Escaramuza',
  standard: 'Estándar',
  grand_offensive: 'Gran Ofensiva',
};

export function ListTable({
  lists,
  onOpen,
  onViewPublic,
  onClonePublic,
  onLikePublic,
  showCreator = true,
  showVisibility = false,
  openLabel = 'Abrir',
}: {
  lists: RemoteList[];
  onOpen?: (list: RemoteList) => void;
  onViewPublic?: (id: string) => void;
  onClonePublic?: (id: string) => void;
  onLikePublic?: (id: string, liked: boolean) => void;
  showCreator?: boolean;
  showVisibility?: boolean;
  openLabel?: string;
}) {
  const rows = useMemo(() => lists.map(toRow), [lists]);
  if (rows.length === 0) return null;

  return (
    <section className="panel saved-list-table-wrap">
      <table className="saved-list-table saved-list-table--directory">
        <thead>
          <tr>
            <th scope="col">Lista</th>
            {showCreator && <th scope="col">Creada por</th>}
            <th scope="col">Raza</th>
            <th scope="col">Escala</th>
            <th scope="col">Validez</th>
            {showVisibility && <th scope="col">Visibilidad</th>}
            <th scope="col">Coste</th>
            <th scope="col">Actualizada</th>
            <th scope="col"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.list.id}>
              <td>
                <div className="saved-list-table__identity">
                  <img className="saved-list-table__logo" src={`/factions/${row.list.race.toLowerCase()}.png`} alt={`Emblema ${RACE_LABEL[row.list.race]}`} />
                  <div>
                    <strong>{row.list.name}</strong>
                    <span>{row.factionName}</span>
                    <small>{row.assignedSlots || 'Sin espacios asignados'}</small>
                  </div>
                </div>
              </td>
              {showCreator && <td>{row.list.ownerNickname ?? 'Usuario'}</td>}
              <td><span className="chip">{RACE_LABEL[row.list.race]}</span></td>
              <td>{row.scaleName}</td>
              <td><span className={`list-status ${row.legal ? 'list-status--valid' : 'list-status--invalid'}`} title={row.legal ? 'Lista válida' : `${row.errorCount} problemas por resolver`} aria-label={row.legal ? 'Lista válida' : `Lista no válida: ${row.errorCount} problemas`}>{row.legal ? '✓' : `× ${row.errorCount}`}</span></td>
              {showVisibility && <td><span className={`list-visibility ${row.list.isPublic ? 'list-visibility--public' : ''}`}>{row.list.isPublic ? 'Pública' : 'Privada'}</span></td>}
              <td>
                <span className="saved-list-table__cost">{row.summary.mineralsSpent}/{row.summary.mineralLimit} min.</span>
                <span className="saved-list-table__cost">{row.summary.vespeneSpent}/{row.summary.vespeneLimit} gas</span>
              </td>
              <td><time dateTime={row.list.remoteUpdatedAt}>{new Date(row.list.remoteUpdatedAt).toLocaleString()}</time></td>
              <td>
                <div className="row saved-list-table__actions">
                  {onOpen && <button type="button" onClick={() => onOpen(row.list)}>{openLabel}</button>}
                  {row.list.isPublic && onViewPublic && <button type="button" onClick={() => onViewPublic(row.list.id)}>Ver lista</button>}
                  {row.list.isPublic && onClonePublic && <button type="button" onClick={() => onClonePublic(row.list.id)}>Clonar</button>}
                  {row.list.isPublic && onLikePublic && <button type="button" className={`like-button${row.list.likedByCurrentUser ? ' like-button--active' : ''}`} aria-label={row.list.likedByCurrentUser ? 'Quitar me gusta' : 'Marcar con me gusta'} aria-pressed={row.list.likedByCurrentUser} onClick={(event) => { event.stopPropagation(); onLikePublic(row.list.id, row.list.likedByCurrentUser); }}><span className="like-button__icon" aria-hidden="true">{row.list.likedByCurrentUser ? '♥' : '♡'}</span><span>{row.list.likeCount}</span></button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

interface ListRow {
  list: RemoteList;
  factionName: string;
  scaleName: string;
  legal: boolean;
  errorCount: number;
  assignedSlots: string;
  summary: ReturnType<typeof computeCosts>;
}

function toRow(list: RemoteList): ListRow {
  const index = buildCatalogIndex(loadCatalog(list.race).catalog);
  const summary = computeCosts(list, index);
  const validation = validateList(list, index);
  const faction = list.factionCardId ? index.factionCards.get(list.factionCardId) : undefined;
  const assignedSlots = SLOT_TYPES
    .filter((type) => summary.slots[type].total > 0 || summary.slots[type].used > 0)
    .map((type) => `${slotLabel(type)} ${summary.slots[type].used}/${summary.slots[type].total}`)
    .join(' · ');
  return { list, factionName: faction?.name ?? 'Sin seleccionar', scaleName: SCALE_LABEL[list.scaleId], legal: validation.legal, errorCount: validation.errors.length, assignedSlots, summary };
}
