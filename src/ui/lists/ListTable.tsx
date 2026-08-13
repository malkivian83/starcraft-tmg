import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { loadCatalog } from '@/catalog/loader';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import { computeCosts } from '@/engine/costing';
import type { RemoteList } from '@/auth/listService';
import type { Race, ScaleId } from '@/engine/types';
import { SLOT_TYPES } from '@/engine/types';
import { validateList } from '@/engine/validate';
import { ProfileAvatar } from '../account/ProfileAvatar';
import { slotLabel } from '../common/Chips';
import { normalizeLocale, type SupportedLocale } from '@/i18n/types';

const RACE_LABEL: Record<Race, string> = { ZERG: 'Zerg', TERRAN: 'Terran', PROTOSS: 'Protoss' };
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
  const { t, i18n } = useTranslation('lists');
  const locale = normalizeLocale(i18n.language) ?? 'es';
  const scaleLabels: Record<ScaleId, string> = { skirmish: t('scaleSkirmish'), standard: t('scaleStandard'), grand_offensive: t('scaleGrandOffensive') };
  const rows = useMemo(() => lists.map((list) => toRow(list, scaleLabels, locale, t('noFaction'))), [lists, locale, scaleLabels, t]);
  if (rows.length === 0) return null;

  return (
    <section className="panel saved-list-table-wrap">
      <table className="saved-list-table saved-list-table--directory">
        <thead>
          <tr>
            <th scope="col">{t('list')}</th>
            {showCreator && <th scope="col">{t('creator')}</th>}
            <th scope="col">{t('race')}</th>
            <th scope="col">{t('scale')}</th>
            <th className="saved-list-table__validity" scope="col">{t('validity')}</th>
            {showVisibility && <th scope="col">{t('visibility')}</th>}
            <th scope="col">{t('cost')}</th>
            <th scope="col">{t('updated')}</th>
            <th scope="col"><span className="sr-only">{t('actions')}</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.list.id}>
              <td>
                <div className="saved-list-table__identity">
                  <img className="saved-list-table__logo" src={`/factions/${row.list.race.toLowerCase()}.png`} alt={`${RACE_LABEL[row.list.race]} ${t('faction').toLocaleLowerCase(locale)}`} />
                  <div>
                    <strong>{row.list.name}</strong>
                    <span>{row.factionName}</span>
                    <small>{row.assignedSlots || t('noSlots')}</small>
                  </div>
                </div>
              </td>
              {showCreator && <td><div className="saved-list-table__owner"><ProfileAvatar user={{ email: 'usuario@local', nickname: row.list.ownerNickname, avatar: row.list.ownerAvatar ?? null }} /><span>{row.list.ownerNickname ?? t('user')}</span></div></td>}
              <td><span className="chip">{RACE_LABEL[row.list.race]}</span></td>
              <td>{row.scaleName}</td>
              <td className="saved-list-table__validity"><span className={`list-status ${row.legal ? 'list-status--valid' : 'list-status--invalid'}`} title={row.legal ? t('validList') : t('invalidList', { count: row.errorCount })} aria-label={row.legal ? t('validList') : t('invalidList', { count: row.errorCount })}>{row.legal ? '✓' : `× ${row.errorCount}`}</span></td>
              {showVisibility && <td><span className={`list-visibility ${row.list.isPublic ? 'list-visibility--public' : ''}`}>{row.list.isPublic ? t('public') : t('private')}</span></td>}
              <td>
                <span className="saved-list-table__cost">{row.summary.mineralsSpent}/{row.summary.mineralLimit} {t('minerals')}</span>
                <span className="saved-list-table__cost">{row.summary.vespeneSpent}/{row.summary.vespeneLimit} {t('gas')}</span>
              </td>
              <td><time dateTime={row.list.remoteUpdatedAt}>{new Date(row.list.remoteUpdatedAt).toLocaleString(locale)}</time></td>
              <td>
                <div className="row saved-list-table__actions">
                  {onOpen && <button type="button" onClick={() => onOpen(row.list)}>{openLabel}</button>}
                  {row.list.isPublic && onViewPublic && <button type="button" onClick={() => onViewPublic(row.list.id)}>{t('view')}</button>}
                  {row.list.isPublic && onClonePublic && <button type="button" onClick={() => onClonePublic(row.list.id)}>{t('clone')}</button>}
                  {row.list.isPublic && onLikePublic && <button type="button" className={`like-button${row.list.likedByCurrentUser ? ' like-button--active' : ''}`} aria-label={row.list.likedByCurrentUser ? t('unlike') : t('like')} aria-pressed={row.list.likedByCurrentUser} onClick={(event) => { event.stopPropagation(); onLikePublic(row.list.id, row.list.likedByCurrentUser); }}><span className="like-button__icon" aria-hidden="true">{row.list.likedByCurrentUser ? '♥' : '♡'}</span><span>{row.list.likeCount}</span></button>}
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

function toRow(list: RemoteList, scaleLabels: Record<ScaleId, string>, locale: SupportedLocale, noFaction: string): ListRow {
  const index = buildCatalogIndex(loadCatalog(list.race).catalog);
  const summary = computeCosts(list, index);
  const validation = validateList(list, index);
  const faction = list.factionCardId ? index.factionCards.get(list.factionCardId) : undefined;
  const assignedSlots = SLOT_TYPES
    .filter((type) => summary.slots[type].total > 0 || summary.slots[type].used > 0)
    .map((type) => `${slotLabel(type, locale)} ${summary.slots[type].used}/${summary.slots[type].total}`)
    .join(' · ');
  return { list, factionName: faction?.name ?? noFaction, scaleName: scaleLabels[list.scaleId], legal: validation.legal, errorCount: validation.errors.length, assignedSlots, summary };
}
