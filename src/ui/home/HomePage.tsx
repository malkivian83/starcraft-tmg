import { useEffect, useState } from 'react';
import { loadHomeData, setPublicListLike, type RemoteList } from '@/auth/listService';
import type { Race } from '@/engine/types';
import { ListTable } from '../lists/ListTable';

const RACES: Array<{ id: Race; label: string; description: string }> = [
  { id: 'ZERG', label: 'Zerg', description: 'La fuerza de la expansión y la adaptación.' },
  { id: 'TERRAN', label: 'Terran', description: 'Tecnología, disciplina y potencia de fuego.' },
  { id: 'PROTOSS', label: 'Protoss', description: 'Élite psiónica y precisión táctica.' },
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
  const [data, setData] = useState<{ recentLists: RemoteList[]; publicLists: RemoteList[] } | null>(null);
  const [message, setMessage] = useState('Cargando tu biblioteca…');

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
        setMessage(error instanceof Error ? error.message : 'No se pudo cargar el inicio.');
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
      setMessage(error instanceof Error ? error.message : 'No se pudo actualizar el me gusta.');
    }
  };

  return (
    <main className="content page-content home-page no-print">
      <section className="home-brand" aria-label="Inicio">
        <img className="home-brand__logo" src="/logo.png" alt="StarCraft: The Miniatures Game" width={521} height={149} />
      </section>

      <section className="home-section" aria-labelledby="home-create-title">
        <div className="home-section__heading">
          <h2 id="home-create-title">Crear una lista</h2>
          <span className="muted small">Elige una raza para empezar directamente.</span>
        </div>
        <div className="home-race-grid">
          {RACES.map((race) => (
            <button key={race.id} type="button" className="home-race-card" onClick={() => onCreateRace(race.id)}>
              <img src={`/factions/${race.id.toLowerCase()}.png`} alt={`Logo ${race.label}`} />
              <span className="home-race-card__copy">
                <strong>{race.label}</strong>
                <small>{race.description}</small>
              </span>
              <span className="home-race-card__action">Crear</span>
            </button>
          ))}
        </div>
      </section>

      {message && <section className="panel empty">{message}</section>}

      {data && (
        <>
          <section className="home-section" aria-labelledby="home-recent-title">
            <div className="home-section__heading">
              <h2 id="home-recent-title">Tus últimas listas</h2>
              <span className="muted small">Hasta 5 listas guardadas recientemente.</span>
            </div>
            {data.recentLists.length === 0 ? (
              <div className="panel empty">Todavía no has guardado ninguna lista.</div>
            ) : (
              <ListTable lists={data.recentLists} onOpen={onOpenOwn} onViewPublic={onViewPublic} onLikePublic={handleLike} onClonePublic={undefined} showCreator showVisibility={false} openLabel="Editar" />
            )}
          </section>

          <section className="home-section" aria-labelledby="home-public-title">
            <div className="home-section__heading">
              <h2 id="home-public-title">Últimas listas públicas</h2>
              <div className="row home-section__heading-actions"><span className="muted small">Las 10 publicaciones más recientes de la comunidad.</span><button type="button" className="button-link button-link--compact" onClick={onViewAllPublic}>Ver todas</button></div>
            </div>
            {data.publicLists.length === 0 ? (
              <div className="panel empty">Todavía no hay listas públicas.</div>
            ) : (
              <ListTable lists={data.publicLists} onViewPublic={onViewPublic} onClonePublic={onClonePublic} onLikePublic={handleLike} showCreator showVisibility={false} />
            )}
          </section>
        </>
      )}
    </main>
  );
}
