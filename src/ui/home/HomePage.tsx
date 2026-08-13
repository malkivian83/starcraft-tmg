import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { loadHomeData, setPublicListLike, type RemoteList } from '@/auth/listService';
import type { Race } from '@/engine/types';
import { ListTable } from '../lists/ListTable';

const RACES: Array<{ id: Race; label: string; description: string }> = [
  { id: 'ZERG', label: 'Zerg', description: 'races.ZERG' },
  { id: 'TERRAN', label: 'Terran', description: 'races.TERRAN' },
  { id: 'PROTOSS', label: 'Protoss', description: 'races.PROTOSS' },
];

export function HomePage({
  onCreateRace,
  onOpenOwn,
  onViewPublic,
  onClonePublic,
  onViewAllPublic,
}: {
  onCreateRace: (race: Race) => void;
  onOpenOwn: (list: RemoteList) => void;
  onViewPublic: (id: string) => void;
  onClonePublic: (id: string) => void;
  onViewAllPublic: () => void;
}) {
  const { t, i18n } = useTranslation('home');
  const [data, setData] = useState<{ recentLists: RemoteList[]; publicLists: RemoteList[] } | null>(null);
  const [message, setMessage] = useState(t('loading'));

  useEffect(() => {
    let active = true;
    void loadHomeData()
      .then((loaded) => {
        if (!active) return;
        setData(loaded);
        setMessage('');
      })
      .catch((error: unknown) => {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : t('loadError'));
      });
    return () => { active = false; };
  }, []);

  const handleLike = async (id: string, liked: boolean) => {
    try {
      const updated = await setPublicListLike(id, !liked);
      setData((current) => current ? {
        ...current,
        recentLists: current.recentLists.map((list) => list.id === id ? updated : list),
        publicLists: current.publicLists.map((list) => list.id === id ? updated : list),
      } : current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('likeError'));
    }
  };

  return (
    <main className="content page-content home-page no-print">
      <section className="home-brand" aria-label={t('ariaLabel')}>
        <img className="home-brand__logo" src="/logo.png" alt="StarCraft: The Miniatures Game" width={521} height={149} />
      </section>

      <section className="home-section" aria-labelledby="home-create-title">
        <div className="home-section__heading">
          <h2 id="home-create-title">{t('createTitle')}</h2>
          <span className="muted small">{t('createHint')}</span>
        </div>
        <div className="home-race-grid">
          {RACES.map((race) => (
            <button key={race.id} type="button" className="home-race-card" onClick={() => onCreateRace(race.id)}>
              <img src={`/factions/${race.id.toLowerCase()}.png`} alt={`Logo ${race.label}`} />
              <span className="home-race-card__copy">
                <strong>{race.label}</strong>
              <small>{t(race.description)}</small>
              </span>
              <span className="home-race-card__action">{t('create')}</span>
            </button>
          ))}
        </div>
      </section>

      {message && <section className="panel empty">{message}</section>}

      {data && (
        <>
          <section className="home-section" aria-labelledby="home-recent-title">
            <div className="home-section__heading">
              <h2 id="home-recent-title">{t('recent')}</h2>
              <span className="muted small">{t('recentHint', { defaultValue: i18n.language.startsWith('en') ? 'Up to 5 recently saved lists.' : 'Hasta 5 listas guardadas recientemente.' })}</span>
            </div>
            {data.recentLists.length === 0 ? (
              <div className="panel empty">{t('emptyRecent')}</div>
            ) : (
              <ListTable lists={data.recentLists} onOpen={onOpenOwn} onViewPublic={onViewPublic} onLikePublic={handleLike} onClonePublic={undefined} showCreator showVisibility={false} openLabel={i18n.language.startsWith('en') ? 'Edit' : 'Editar'} />
            )}
          </section>

          <section className="home-section" aria-labelledby="home-public-title">
            <div className="home-section__heading">
              <h2 id="home-public-title">{t('publicRecent')}</h2>
              <div className="row home-section__heading-actions"><span className="muted small">{t('publicHint')}</span><button type="button" className="button-link button-link--compact" onClick={onViewAllPublic}>{t('viewAll')}</button></div>
            </div>
            {data.publicLists.length === 0 ? (
              <div className="panel empty">{t('emptyPublic')}</div>
            ) : (
              <ListTable lists={data.publicLists} onViewPublic={onViewPublic} onClonePublic={onClonePublic} onLikePublic={handleLike} showCreator showVisibility={false} />
            )}
          </section>
        </>
      )}
    </main>
  );
}
