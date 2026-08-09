import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { deleteRemoteList, loadRemoteLists, setListPublic, type RemoteList } from '@/auth/listService';
import { loadCatalog } from '@/catalog/loader';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import { computeCosts } from '@/engine/costing';
import type { ArmyList, Race, ScaleId } from '@/engine/types';
import { SLOT_TYPES } from '@/engine/types';
import { validateList } from '@/engine/validate';
import { slotLabel } from '../common/Chips';
import { normalizeLocale, type SupportedLocale } from '@/i18n/types';

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
  onViewPublic,
}: {
  onCreate: () => void;
  onLoad: (list: ArmyList, revision: number) => void;
  onViewPublic: (id: string) => void;
}) {
  const { t, i18n } = useTranslation('lists');
  const locale = normalizeLocale(i18n.language) ?? 'es';
  const scaleLabels: Record<ScaleId, string> = {
    skirmish: t('scaleSkirmish'),
    standard: t('scaleStandard'),
    grand_offensive: t('scaleGrandOffensive'),
  };
  const [lists, setLists] = useState<RemoteList[]>([]);
  const [message, setMessage] = useState(t('loading'));
  const [raceFilter, setRaceFilter] = useState<RaceFilter>('ALL');
  const [scaleFilter, setScaleFilter] = useState<ScaleId | 'ALL'>('ALL');
  const [validityFilter, setValidityFilter] = useState<ValidityFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('updated-desc');

  const refresh = async () => {
    try {
      const loaded = await loadRemoteLists();
      setLists(loaded);
      setMessage(loaded.length ? '' : t('noSaved'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('loadError'));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const rows = useMemo(() => lists.map((list) => toSavedListRow(list, scaleLabels, locale, t('noFaction'))), [lists, locale, scaleLabels, t]);
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
    if (!window.confirm(t('deleteConfirm', { name: list.name }))) return;
    try {
      await deleteRemoteList(list.id);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('loadError'));
    }
  };

  const togglePublic = async (list: RemoteList) => {
    try {
      const updated = await setListPublic(list.id, !list.isPublic);
      setLists((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('loadError'));
    }
  };

  const clearFilters = () => {
    setRaceFilter('ALL');
    setScaleFilter('ALL');
    setValidityFilter('ALL');
    setSortBy('updated-desc');
  };

  return (
    <main className="content page-content lists-page no-print">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('library')}</p>
          <h1>{t('myTitle')}</h1>
          <p className="muted">{t('myDescription')}</p>
        </div>
        <button onClick={onCreate}>{t('create')}</button>
      </section>

      {message && <section className="panel empty">{message}</section>}

      {lists.length > 0 && (
        <section className="panel saved-list-filters" aria-label={t('filterAria')}>
          <label className="field">
            {t('race')}
            <select value={raceFilter} onChange={(event) => setRaceFilter(event.target.value as RaceFilter)}>
              <option value="ALL">{t('all')}</option>
              <option value="ZERG">Zerg</option>
              <option value="TERRAN">Terran</option>
              <option value="PROTOSS">Protoss</option>
            </select>
          </label>
          <label className="field">
            {t('scale')}
            <select value={scaleFilter} onChange={(event) => setScaleFilter(event.target.value as ScaleId | 'ALL')}>
              <option value="ALL">{t('all')}</option>
              <option value="skirmish">{t('scaleSkirmish')}</option>
              <option value="standard">{t('scaleStandard')}</option>
              <option value="grand_offensive">{t('scaleGrandOffensive')}</option>
            </select>
          </label>
          <label className="field">
            {t('validity')}
            <select value={validityFilter} onChange={(event) => setValidityFilter(event.target.value as ValidityFilter)}>
              <option value="ALL">{t('all')}</option>
              <option value="VALID">{t('valid')}</option>
              <option value="INVALID">{t('invalid')}</option>
            </select>
          </label>
          <label className="field">
            {t('sort', { defaultValue: locale === 'en' ? 'Sort by' : 'Ordenar por' })}
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}>
              <option value="updated-desc">{t('recent')}</option>
              <option value="updated-asc">{t('oldest')}</option>
              <option value="name-asc">{t('nameAsc')}</option>
              <option value="name-desc">{t('nameDesc')}</option>
              <option value="race-asc">{t('raceSort')}</option>
              <option value="scale-asc">{t('scaleSort')}</option>
              <option value="validity">{t('validSort')}</option>
            </select>
          </label>
          <div className="saved-list-filters__summary">
            <span className="muted small">{t('listCount', { visible: visibleRows.length, total: rows.length })}</span>
            {(raceFilter !== 'ALL' || scaleFilter !== 'ALL' || validityFilter !== 'ALL' || sortBy !== 'updated-desc') && (
              <button type="button" className="button-link button-link--compact" onClick={clearFilters}>{t('clear')}</button>
            )}
          </div>
        </section>
      )}

      {lists.length > 0 && visibleRows.length === 0 && (
        <section className="panel empty">{t('noMatches')}</section>
      )}

      {visibleRows.length > 0 && (
        <section className="panel saved-list-table-wrap">
          <table className="saved-list-table saved-list-table--owner">
            <thead>
              <tr>
                <th scope="col">{t('list')}</th>
                <th scope="col">{t('race')}</th>
                <th scope="col">{t('scale')}</th>
                <th scope="col">{t('validity')}</th>
                <th scope="col">{t('visibility')}</th>
                <th scope="col">{t('cost')}</th>
                <th scope="col">{t('updated')}</th>
                <th scope="col"><span className="sr-only">{t('actions')}</span></th>
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
                        alt={`${RACE_LABEL[row.list.race]} ${t('faction').toLocaleLowerCase(locale)}`}
                      />
                      <div>
                        <strong>{row.list.name}</strong>
                        <span>{row.factionName}</span>
                        <small>{row.assignedSlots || t('noSlots')}</small>
                      </div>
                    </div>
                  </td>
                  <td><span className="chip">{RACE_LABEL[row.list.race]}</span></td>
                  <td>{row.scaleName}</td>
                  <td>
                    <span className={`list-status ${row.legal ? 'list-status--valid' : 'list-status--invalid'}`}>
                      {row.legal ? t('validityShort') : t('invalidShort', { count: row.errorCount })}
                    </span>
                  </td>
                  <td>
                    <span className={`list-visibility ${row.list.isPublic ? 'list-visibility--public' : ''}`}>
                      {row.list.isPublic ? t('public') : t('private')}
                    </span>
                  </td>
                  <td>
                    <span className="saved-list-table__cost">{row.summary.mineralsSpent}/{row.summary.mineralLimit} {t('minerals')}</span>
                    <span className="saved-list-table__cost">{row.summary.vespeneSpent}/{row.summary.vespeneLimit} {t('gas')}</span>
                  </td>
                  <td><time dateTime={row.list.remoteUpdatedAt}>{new Date(row.list.remoteUpdatedAt).toLocaleString(locale)}</time></td>
                  <td>
                    <div className="row saved-list-table__actions">
                      <button type="button" onClick={() => onLoad(row.list, row.list.revision)}>{t('open')}</button>
                      {row.list.isPublic && <button type="button" onClick={() => onViewPublic(row.list.id)}>{t('view')}</button>}
                      <button type="button" onClick={() => { void togglePublic(row.list); }}>{row.list.isPublic ? t('makePrivate') : t('makePublic')}</button>
                      <button type="button" onClick={() => { void remove(row.list); }}>{t('delete')}</button>
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

function toSavedListRow(list: RemoteList, scaleLabels: Record<ScaleId, string>, locale: SupportedLocale, noFaction: string): SavedListRow {
  const index = buildCatalogIndex(loadCatalog(list.race).catalog);
  const summary = computeCosts(list, index);
  const validation = validateList(list, index);
  const faction = list.factionCardId ? index.factionCards.get(list.factionCardId) : undefined;
  const assignedSlots = SLOT_TYPES
    .filter((type) => summary.slots[type].total > 0 || summary.slots[type].used > 0)
    .map((type) => `${slotLabel(type, locale)} ${summary.slots[type].used}/${summary.slots[type].total}`)
    .join(' · ');

  return {
    list,
    factionName: faction?.name ?? noFaction,
    scaleName: scaleLabels[list.scaleId],
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
