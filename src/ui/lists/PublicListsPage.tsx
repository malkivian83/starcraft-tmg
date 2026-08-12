import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadCatalog } from '@/catalog/loader';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import { loadPublicLists, setPublicListLike, type RemoteList } from '@/auth/listService';
import type { Race, ScaleId } from '@/engine/types';
import { validateList } from '@/engine/validate';
import { ListTable } from './ListTable';
import { normalizeLocale } from '@/i18n/types';

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
  const { t, i18n } = useTranslation('lists');
  const locale = normalizeLocale(i18n.language) ?? 'es';
  const scaleLabels: Record<ScaleId, string> = { skirmish: t('scaleSkirmish'), standard: t('scaleStandard'), grand_offensive: t('scaleGrandOffensive') };
  const [lists, setLists] = useState<RemoteList[]>([]);
  const [message, setMessage] = useState(t('loading'));
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
        setMessage(loaded.length ? '' : t('noPublic'));
      })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : t('publicLoadError'));
      });
    return () => { active = false; };
  }, []);

  const handleLike = async (id: string, liked: boolean) => {
    try {
      const updated = await setPublicListLike(id, !liked);
      setLists((current) => current.map((list) => list.id === id ? updated : list));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('likeError'));
    }
  };

  const validityById = useMemo(() => new Map(lists.map((list) => [list.id, isListValid(list)])), [lists]);
  const visibleLists = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    const filtered = lists.filter((list) => {
      if (query && !`${list.name} ${list.ownerNickname ?? ''} ${RACE_LABEL[list.race]} ${scaleLabels[list.scaleId]}`.toLocaleLowerCase(locale).includes(query)) return false;
      if (raceFilter !== 'ALL' && list.race !== raceFilter) return false;
      if (scaleFilter !== 'ALL' && list.scaleId !== scaleFilter) return false;
      if (validityFilter !== 'ALL' && validityById.get(list.id) !== (validityFilter === 'VALID')) return false;
      return true;
    });
    return filtered.sort((a, b) => compareLists(a, b, sortBy, validityById));
  }, [lists, locale, raceFilter, scaleFilter, scaleLabels, validityFilter, sortBy, search, validityById]);

  const clearFilters = () => {
    setSearch('');
    setRaceFilter('ALL');
    setScaleFilter('ALL');
    setValidityFilter('ALL');
    setSortBy('updated-desc');
  };

  return (
    <main className="content page-content public-lists-page no-print">
      <section className="page-heading">
        <div>
          <p className="eyebrow">{t('library')}</p>
          <h1>{t('publicTitle')}</h1>
          <p className="muted">{t('publicDescription')}</p>
        </div>
      </section>

      {message && <section className="panel empty">{message}</section>}

      {lists.length > 0 && (
        <section className="panel saved-list-filters public-list-filters" aria-label={t('filterAria')}>
          <label className="field public-list-filters__search">
            {t('searchLabel')}
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('search')} />
          </label>
          <label className="field">{t('race')}<select value={raceFilter} onChange={(event) => setRaceFilter(event.target.value as RaceFilter)}><option value="ALL">{t('all')}</option><option value="ZERG">Zerg</option><option value="TERRAN">Terran</option><option value="PROTOSS">Protoss</option></select></label>
          <label className="field">{t('scale')}<select value={scaleFilter} onChange={(event) => setScaleFilter(event.target.value as ScaleId | 'ALL')}><option value="ALL">{t('all')}</option><option value="skirmish">{t('scaleSkirmish')}</option><option value="standard">{t('scaleStandard')}</option><option value="grand_offensive">{t('scaleGrandOffensive')}</option></select></label>
          <label className="field">{t('validity')}<select value={validityFilter} onChange={(event) => setValidityFilter(event.target.value as ValidityFilter)}><option value="ALL">{t('all')}</option><option value="VALID">{t('valid')}</option><option value="INVALID">{t('invalid')}</option></select></label>
          <label className="field">{t('sort', { defaultValue: locale === 'en' ? 'Sort by' : 'Ordenar por' })}<select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortOption)}><option value="updated-desc">{t('recent')}</option><option value="likes-desc">{t('popular')}</option><option value="updated-asc">{t('oldest')}</option><option value="name-asc">{t('nameAsc')}</option><option value="name-desc">{t('nameDesc')}</option><option value="race-asc">{t('raceSort')}</option><option value="scale-asc">{t('scaleSort')}</option><option value="validity">{t('validSort')}</option></select></label>
          <div className="saved-list-filters__summary"><span className="muted small">{t('listCount', { visible: visibleLists.length, total: lists.length })}</span>{(search || raceFilter !== 'ALL' || scaleFilter !== 'ALL' || validityFilter !== 'ALL' || sortBy !== 'updated-desc') && <button type="button" className="button-link button-link--compact" onClick={clearFilters}>{t('clear')}</button>}</div>
        </section>
      )}

      {lists.length > 0 && visibleLists.length === 0 && <section className="panel empty">{t('noPublicMatches')}</section>}
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
