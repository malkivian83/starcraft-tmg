import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadCatalog } from '@/catalog/loader';
import { deriveGameState, type GameCommand, type GamePlayerSlot, type GameSession } from '@/engine/gameSession';
import type { MissionCard, Race } from '@/engine/types';
import { claimGame, createGame, deleteGame, linkGameToList, loadGames, loadGuestGames, sendGameCommand } from '@/auth/gameService';
import { loadRemoteLists, type RemoteList } from '@/auth/listService';
import { localizedPath, routeLocale } from '@/i18n/routing';
import './game.css';

const RACES: Race[] = ['ZERG', 'TERRAN', 'PROTOSS'];
const RACE_LABEL: Record<Race, string> = { ZERG: 'Zerg', TERRAN: 'Terran', PROTOSS: 'Protoss' };
const MISSION_SCALE_GROUPS = ['skirmish', 'standard'] as const;

function raceLogo(race: Race): string {
  return `/factions/${race.toLowerCase()}.png`;
}

export type GameView = 'library' | 'setup' | 'board';

export function initialGameView(mode: 'guest' | 'account', forcedNew: boolean): GameView {
  return mode === 'guest' || forcedNew ? 'setup' : 'library';
}

function localized(value: { es: string; en: string }, en: boolean): string {
  return en ? value.en : value.es;
}

function dateLabel(value: string, en: boolean): string {
  return new Intl.DateTimeFormat(en ? 'en-GB' : 'es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function updateSetupPlayer(players: [{ name: string; race: Race }, { name: string; race: Race }], index: number, patch: Partial<{ name: string; race: Race }>): typeof players {
  return index === 0
    ? [{ ...players[0], ...patch }, players[1]]
    : [players[0], { ...players[1], ...patch }];
}

function suggestedWinner(game: GameSession): { winnerPlayerSlot: GamePlayerSlot | null; finishReason: 'ROUNDS_COMPLETE' | 'SPECIAL_VICTORY' | 'DRAW' } {
  const derived = deriveGameState(game);
  if (derived.instantVictory && derived.leader) return { winnerPlayerSlot: derived.leader, finishReason: 'SPECIAL_VICTORY' };
  if (derived.leader) return { winnerPlayerSlot: derived.leader, finishReason: 'ROUNDS_COMPLETE' };
  return { winnerPlayerSlot: null, finishReason: 'DRAW' };
}

export function GamePage({ mode }: { mode: 'guest' | 'account' }) {
  const locale = routeLocale(window.location.pathname);
  const en = locale === 'en';
  const missions = useMemo(() => loadCatalog('ZERG').catalog.missionCards, []);
  const forcedNew = window.location.pathname.includes('/partidas/nueva') || window.location.pathname.includes('/games/new');
  const routeId = window.location.pathname.match(/(?:partidas|games)\/([^/]+)$/)?.[1] ?? null;
  const [games, setGames] = useState<GameSession[]>([]);
  const [selected, setSelected] = useState<GameSession | null>(null);
  // Las sesiones invitadas se guardan, pero no se muestran como una biblioteca:
  // el flujo de entrada siempre empieza en la configuración de una nueva partida.
  const [view, setView] = useState<GameView>(initialGameView(mode, forcedNew));
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [lists, setLists] = useState<RemoteList[]>([]);
  const [guestGames, setGuestGames] = useState<GameSession[]>([]);
  const [pointsLimit, setPointsLimit] = useState('1000');
  const [missionId, setMissionId] = useState(missions.find((mission) => mission.scale === 'skirmish')?.id ?? missions[0]?.id ?? '');
  const [players, setPlayers] = useState<[{ name: string; race: Race }, { name: string; race: Race }]>([
    { name: en ? 'Player 1' : 'Jugador 1', race: 'ZERG' },
    { name: en ? 'Player 2' : 'Jugador 2', race: 'TERRAN' },
  ]);

  const mission = missions.find((item) => item.id === missionId) ?? missions[0];
  const refresh = async () => {
    setLoading(true);
    try {
      const loaded = await loadGames();
      setGames(loaded);
      const routeGame = routeId ? loaded.find((game) => game.id === decodeURIComponent(routeId)) : null;
      if (routeGame) { setSelected(routeGame); setView('board'); }
      else if (mode === 'guest' || forcedNew) setView((current) => current === 'board' ? current : 'setup');
      else if (loaded.length === 0) setView('setup');
      else setView((current) => current === 'board' ? current : 'library');
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? 'Games could not be loaded.' : 'No se pudieron cargar las partidas.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    if (mode !== 'account') return;
    void loadRemoteLists({ limit: 100 }).then((loaded) => setLists(loaded.lists)).catch(() => undefined);
    void loadGuestGames().then(setGuestGames).catch(() => setGuestGames([]));
  }, [mode]);

  const selectGame = (game: GameSession) => { setSelected(game); setView('board'); setMessage(null); };
  const startNew = () => { setSelected(null); setMessage(null); setView('setup'); };

  const submitSetup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mission) return;
    const parsedPoints = Number(pointsLimit);
    if (!Number.isInteger(parsedPoints) || parsedPoints <= 0 || players.some((player) => !player.name.trim())) {
      setMessage(en ? 'Enter a positive point limit and both player names.' : 'Indica un límite positivo y los nombres de los dos jugadores.');
      return;
    }
    setPending(true);
    try {
      const created = await createGame({ pointsLimit: parsedPoints, missionId: mission.id, players });
      setGames((current) => [created, ...current]);
      setSelected(created);
      setView('board');
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? 'The game could not be created.' : 'No se pudo crear la partida.'));
    } finally { setPending(false); }
  };

  const command = async (value: GameCommand) => {
    if (!selected || pending) return;
    setPending(true);
    try {
      const updated = await sendGameCommand(selected.id, selected.revision, value);
      setSelected(updated);
      setGames((current) => current.map((game) => game.id === updated.id ? updated : game));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? 'The game could not be updated.' : 'No se pudo actualizar la partida.'));
      await refresh();
    } finally { setPending(false); }
  };

  const finalize = () => {
    if (!selected || selected.status !== 'ACTIVE') return;
    const derived = deriveGameState(selected);
    if (selected.currentRound < selected.mission.gameLength && !derived.instantVictory) return;
    const suggestion = suggestedWinner(selected);
    const label = suggestion.winnerPlayerSlot ? selected.players[suggestion.winnerPlayerSlot - 1]!.name : (en ? 'a draw' : 'un empate');
    const reason = suggestion.finishReason === 'SPECIAL_VICTORY'
      ? (en ? ' by special victory' : ' por victoria especial')
      : '';
    if (!window.confirm(en ? `Finish the game${reason} with ${label}? You will not be able to edit it afterwards.` : `¿Finalizar la partida${reason} con ${label}? Después no podrás editarla.`)) return;
    void command({ type: 'FINALIZE', ...suggestion });
  };

  const linkToList = async (listId: string, ownerPlayerSlot: 1 | 2) => {
    if (!selected || pending) return;
    setPending(true);
    try {
      const updated = await linkGameToList(selected.id, selected.revision, listId, ownerPlayerSlot);
      setSelected(updated);
      setGames((current) => current.map((game) => game.id === updated.id ? updated : game));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? 'The game could not be added to the list history.' : 'No se pudo añadir la partida al historial de la lista.'));
    } finally { setPending(false); }
  };

  const claim = async (game: GameSession) => {
    if (pending) return;
    setPending(true);
    try {
      const claimed = await claimGame(game.id);
      setGames((current) => [claimed, ...current.filter((item) => item.id !== claimed.id)]);
      setGuestGames((current) => current.filter((item) => item.id !== claimed.id));
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : (en ? 'The game could not be saved to your account.' : 'No se pudo guardar la partida en tu cuenta.'));
    } finally { setPending(false); }
  };

  const remove = async (game: GameSession) => {
    if (!window.confirm(en ? 'Delete this saved game?' : '¿Borrar esta partida guardada?')) return;
    try {
      await deleteGame(game.id);
      setGames((current) => current.filter((item) => item.id !== game.id));
      if (selected?.id === game.id) { setSelected(null); setView('library'); }
    } catch (error) { setMessage(error instanceof Error ? error.message : (en ? 'The game could not be deleted.' : 'No se pudo borrar la partida.')); }
  };

  return <div className={`game-page${view === 'board' && selected ? ' game-page--board' : ''}`}>
    <header className="game-header">
      <Link to={localizedPath('home', locale)} className="game-header__brand"><img src="/logo.png" alt="StarCraft: The Miniatures Game" /><span>{en ? 'Game manager' : 'Gestor de partidas'}</span></Link>
      <div className="game-header__actions"><span className="game-owner-badge">{mode === 'account' ? (en ? 'My games' : 'Mis partidas') : (en ? 'Guest · this browser' : 'Invitado · este navegador')}</span><Link className="button-link" to={localizedPath('home', locale)}>{en ? 'Exit' : 'Salir'}</Link></div>
    </header>
    <main className="game-main">
      {message && <p className="game-message" role="alert">{message}</p>}
      {loading ? <section className="game-panel game-empty">{en ? 'Loading games…' : 'Cargando partidas…'}</section> : view === 'setup' ? (
        <SetupView en={en} mission={mission} missions={missions} missionId={missionId} pointsLimit={pointsLimit} players={players} pending={pending} onMission={setMissionId} onPoints={setPointsLimit} onPlayers={setPlayers} onSubmit={submitSetup} onCancel={() => mode === 'account' ? setView('library') : window.location.assign(localizedPath('home', locale))} />
      ) : view === 'board' && selected ? (
        <BoardView en={en} mode={mode} game={selected} lists={lists} pending={pending} onCommand={command} onFinalize={finalize} onLink={(listId, slot) => { void linkToList(listId, slot); }} onBack={() => setView(mode === 'account' ? 'library' : 'setup')} />
      ) : (
        <LibraryView en={en} mode={mode} games={games} guestGames={guestGames} pending={pending} onClaim={(game) => { void claim(game); }} onNew={startNew} onOpen={selectGame} onDelete={(game) => { void remove(game); }} />
      )}
    </main>
  </div>;
}

function RacePicker({ id, labelId, value, onChange }: {
  id: string;
  labelId: string;
  value: Race;
  onChange: (race: Race) => void;
}) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = RACES.indexOf(value);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);

  const focusOption = (index: number) => {
    const normalizedIndex = (index + RACES.length) % RACES.length;
    optionRefs.current[normalizedIndex]?.focus();
  };

  const openAt = (index: number) => {
    const triggerRect = triggerRef.current?.getBoundingClientRect();
    if (triggerRect) {
      const estimatedMenuHeight = RACES.length * 48 + 24;
      const spaceBelow = window.innerHeight - triggerRect.bottom;
      setOpenUpward(spaceBelow < estimatedMenuHeight && triggerRect.top > spaceBelow);
    }
    setOpen(true);
    window.requestAnimationFrame(() => focusOption(index));
  };

  const closeAndFocusTrigger = () => {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const selectRace = (race: Race) => {
    onChange(race);
    closeAndFocusTrigger();
  };

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openAt(selectedIndex);
    } else if (event.key === 'Home') {
      event.preventDefault();
      openAt(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      openAt(RACES.length - 1);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeAndFocusTrigger();
    }
  };

  const handleOptionKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusOption(index + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusOption(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusOption(RACES.length - 1);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      closeAndFocusTrigger();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return <div
    className={`game-race-picker${open ? ' game-race-picker--open' : ''}${openUpward ? ' game-race-picker--up' : ''}`}
    ref={rootRef}
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}
  >
    <button
      className="game-race-picker__trigger"
      id={id}
      ref={triggerRef}
      type="button"
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={`${id}-options`}
      aria-labelledby={`${labelId} ${id}-value`}
      onClick={() => open ? setOpen(false) : openAt(selectedIndex)}
      onKeyDown={handleTriggerKeyDown}
    >
      <span className="game-race-picker__identity">
        <img src={raceLogo(value)} width="36" height="36" alt="" />
        <span id={`${id}-value`}>{RACE_LABEL[value]}</span>
      </span>
      <span className="game-race-picker__caret" aria-hidden="true" />
    </button>
    <div
      className="game-race-picker__options"
      id={`${id}-options`}
      role="listbox"
      aria-labelledby={labelId}
      hidden={!open}
    >
      {RACES.map((race, index) => <button
        className="game-race-picker__option"
        key={race}
        ref={(element) => { optionRefs.current[index] = element; }}
        type="button"
        role="option"
        tabIndex={-1}
        aria-selected={race === value}
        onClick={() => selectRace(race)}
        onKeyDown={(event) => handleOptionKeyDown(event, index)}
      >
        <span className="game-race-picker__identity">
          <img src={raceLogo(race)} width="36" height="36" alt="" />
          <span>{RACE_LABEL[race]}</span>
        </span>
        <span className="game-race-picker__check" aria-hidden="true">{race === value ? '✓' : ''}</span>
      </button>)}
    </div>
  </div>;
}

function SetupView({ en, mission, missions, missionId, pointsLimit, players, pending, onMission, onPoints, onPlayers, onSubmit, onCancel }: {
  en: boolean; mission: MissionCard | undefined; missions: MissionCard[]; missionId: string; pointsLimit: string; players: [{ name: string; race: Race }, { name: string; race: Race }]; pending: boolean;
  onMission: (value: string) => void; onPoints: (value: string) => void; onPlayers: (value: [{ name: string; race: Race }, { name: string; race: Race }]) => void; onSubmit: (event: React.FormEvent) => void; onCancel: () => void;
}) {
  return <section className="game-panel game-setup" aria-labelledby="game-setup-title">
    <div className="game-panel__heading"><div><p className="game-eyebrow">{en ? 'New 1v1 game' : 'Nueva partida 1v1'}</p><h1 id="game-setup-title">{en ? 'Configure the table' : 'Configura la mesa'}</h1></div></div>
    <form onSubmit={onSubmit} className="game-form">
      <label className="field"><span>{en ? 'Game points' : 'Puntos de la partida'}</span><input type="number" min="1" step="1" value={pointsLimit} onChange={(event) => onPoints(event.target.value)} required /></label>
      <label className="field">
        <span>{en ? 'Mission and variant' : 'Misión y variante'}</span>
        <select value={missionId} onChange={(event) => onMission(event.target.value)}>
          {MISSION_SCALE_GROUPS.map((scale) => <optgroup
            key={scale}
            label={scale === 'skirmish' ? (en ? 'Skirmish' : 'Escaramuza') : (en ? 'Standard' : 'Estándar')}
          >
            {missions.filter((item) => item.scale === scale).map((item) => <option key={item.id} value={item.id}>
              {item.name} · {scale === 'skirmish' ? (en ? 'Skirmish' : 'Escaramuza') : (en ? 'Standard' : 'Estándar')}
            </option>)}
          </optgroup>)}
        </select>
      </label>
      {mission && <div className="game-mission-summary"><strong>{mission.name}</strong><span>{en ? 'Starting supply' : 'Suministro inicial'}: {mission.startingSupply} · +{mission.supplyEscalation} {en ? 'per round' : 'por ronda'} · {mission.gameLength} {en ? 'rounds' : 'rondas'}</span><small>{localized(mission.additionalConditions, en)}</small></div>}
      <div className="game-player-setup-grid">
        {players.map((player, index) => {
          const racePickerId = `game-player-${index + 1}-race`;
          const raceLabelId = `${racePickerId}-label`;
          return <fieldset className="game-player-setup" key={index}>
            <legend>{en ? `Player ${index + 1}` : `Jugador ${index + 1}`}</legend>
            <label className="field">
              <span>{en ? 'Name' : 'Nombre'}</span>
              <input value={player.name} maxLength={80} onChange={(event) => onPlayers(updateSetupPlayer(players, index, { name: event.target.value }))} required />
            </label>
            <div className="field">
              <label id={raceLabelId} htmlFor={racePickerId}>{en ? 'Race' : 'Raza'}</label>
              <RacePicker
                id={racePickerId}
                labelId={raceLabelId}
                value={player.race}
                onChange={(race) => onPlayers(updateSetupPlayer(players, index, { race }))}
              />
            </div>
          </fieldset>;
        })}
      </div>
      <div className="game-form__actions"><button className="button-link" type="button" onClick={onCancel}>{en ? 'Cancel' : 'Cancelar'}</button><button className="button-primary" type="submit" disabled={pending || !mission}>{pending ? (en ? 'Starting…' : 'Iniciando…') : (en ? 'Start game' : 'Empezar partida')}</button></div>
    </form>
  </section>;
}

function LibraryView({ en, mode, games, guestGames, pending, onClaim, onNew, onOpen, onDelete }: { en: boolean; mode: 'guest' | 'account'; games: GameSession[]; guestGames: GameSession[]; pending: boolean; onClaim: (game: GameSession) => void; onNew: () => void; onOpen: (game: GameSession) => void; onDelete: (game: GameSession) => void }) {
  const renderCards = (items: GameSession[], guest = false) => <div className="game-library-grid">{items.map((game) => { const derived = deriveGameState(game); const first = game.players[0]!; const second = game.players[1]!; return <article className="game-card" key={`${guest ? 'guest-' : ''}${game.id}`}><div className="game-card__top"><span className={`game-status game-status--${game.status.toLowerCase()}`}>{game.status === 'ACTIVE' ? (en ? 'In progress' : 'En curso') : game.status === 'FINISHED' ? (en ? 'Finished' : 'Finalizada') : (en ? 'Abandoned' : 'Abandonada')}</span><span className="muted small">{dateLabel(game.updatedAt, en)}</span></div><h2>{first.name} <span>vs</span> {second.name}</h2><p>{game.mission.name} · {game.mission.scale === 'skirmish' ? (en ? 'Skirmish' : 'Escaramuza') : (en ? 'Standard' : 'Estándar')}</p><p className="game-card__score">{first.victoryPoints} — {second.victoryPoints} <small>· {en ? `Round ${game.currentRound}/${game.mission.gameLength}` : `Ronda ${game.currentRound}/${game.mission.gameLength}`}</small></p><div className="game-card__actions">{guest ? <button className="button-primary" disabled={pending} onClick={() => onClaim(game)}>{en ? 'Save to my account' : 'Guardar en mi cuenta'}</button> : <><button className="button-primary" onClick={() => onOpen(game)}>{game.status === 'ACTIVE' ? (en ? 'Continue' : 'Continuar') : (en ? 'View' : 'Ver')}</button><button className="button-link" onClick={() => onDelete(game)}>{en ? 'Delete' : 'Borrar'}</button></>}</div><span className="sr-only">{en ? `Margin ${derived.margin}` : `Margen ${derived.margin}`}</span></article>; })}</div>;
  return <section className="game-panel" aria-labelledby="game-library-title"><div className="game-panel__heading"><div><p className="game-eyebrow">{en ? 'Saved sessions' : 'Sesiones guardadas'}</p><h1 id="game-library-title">{en ? 'My games' : 'Mis partidas'}</h1></div><button className="button-primary" onClick={onNew}>{en ? 'New game' : 'Nueva partida'}</button></div>{mode === 'account' && guestGames.length > 0 && <div className="game-claim-banner"><strong>{en ? `${guestGames.length} guest game${guestGames.length === 1 ? '' : 's'} found in this browser.` : `Hay ${guestGames.length} partida${guestGames.length === 1 ? '' : 's'} invitada${guestGames.length === 1 ? '' : 's'} en este navegador.`}</strong><span>{en ? 'Review and save them to your account.' : 'Revísalas y guárdalas en tu cuenta.'}</span>{renderCards(guestGames, true)}</div>}{games.length === 0 ? <div className="game-empty">{en ? 'No games saved yet.' : 'Todavía no hay partidas guardadas.'}</div> : renderCards(games)}</section>;
}

export function BoardView({ en, mode, game, lists, pending, onCommand, onFinalize, onLink, onBack }: { en: boolean; mode: 'guest' | 'account'; game: GameSession; lists: RemoteList[]; pending: boolean; onCommand: (command: GameCommand) => void; onFinalize: () => void; onLink: (listId: string, slot: 1 | 2) => void; onBack: () => void }) {
  const derived = deriveGameState(game);
  const player = (slot: GamePlayerSlot) => game.players[slot - 1]!;
  const locked = game.status !== 'ACTIVE';
  const finalized = game.status === 'FINISHED';
  const compatibleLists = lists.filter((list) => list.race === player(1).race || list.race === player(2).race);
  const missionScale = game.mission.scale === 'skirmish'
    ? (en ? 'Skirmish' : 'Escaramuza')
    : game.mission.scale === 'standard'
      ? (en ? 'Standard' : 'Estándar')
      : (en ? 'Grand offensive' : 'Gran ofensiva');
  const supplyDisplay = derived.supply === 'UNLIMITED' ? '∞' : String(derived.supply);
  const supplyDescription = derived.supply === 'UNLIMITED'
    ? (en ? 'No mission supply limit' : 'Sin límite de suministro de misión')
    : (en ? 'Same limit for each player' : 'Mismo límite para cada jugador');
  const nextSupplyLabel = locked
    ? (finalized ? (en ? 'Game finished' : 'Partida finalizada') : (en ? 'Game closed' : 'Partida cerrada'))
    : derived.nextSupply === null
    ? (en ? 'Final round · complete scoring' : 'Ronda final · completa la puntuación')
    : derived.nextSupply === 'UNLIMITED'
      ? (en ? 'Next round: unlimited supply' : 'Siguiente ronda: suministro ilimitado')
      : (en ? `Next round: ${derived.nextSupply} supply` : `Siguiente ronda: ${derived.nextSupply} de suministro`);
  const supplyContextDetail = derived.supply === 'UNLIMITED' || locked
    ? supplyDescription
    : `${supplyDescription} · +${game.mission.supplyEscalation} ${en ? 'per round' : 'por ronda'}`;
  const officialWinner = finalized ? game.winnerPlayerSlot : derived.leader;
  const marginTitle = officialWinner === null ? (en ? 'Draw' : 'Empate') : player(officialWinner).name;
  const marginDetail = finalized
    ? officialWinner === null
      ? (en ? `Draw · margin ${derived.margin} VP` : `Empate · margen ${derived.margin} PV`)
      : (en ? `Winner · margin ${derived.margin} VP` : `Ganador · margen ${derived.margin} PV`)
    : derived.leader === null
      ? (en ? 'Margin 0 VP' : 'Margen 0 PV')
      : (en ? `Leads by ${derived.margin} VP` : `Lidera por ${derived.margin} PV`);
  const specialVictoryDetail = game.mission.instantWinLead === null
    ? null
    : finalized && game.finishReason === 'SPECIAL_VICTORY' && game.winnerPlayerSlot
      ? (en
        ? `Special victory for ${player(game.winnerPlayerSlot).name} · ${derived.margin} VP margin`
        : `Victoria especial de ${player(game.winnerPlayerSlot).name} · margen de ${derived.margin} PV`)
      : derived.instantVictory
      ? (en ? `Special victory threshold: ${game.mission.instantWinLead} VP` : `Umbral de victoria especial: ${game.mission.instantWinLead} PV`)
      : derived.leader === null
        ? (en ? `Special victory at a ${game.mission.instantWinLead} VP lead` : `Victoria especial a ${game.mission.instantWinLead} PV de ventaja`)
        : (en
          ? `${player(derived.leader).name} needs ${game.mission.instantWinLead - derived.margin} more VP of margin`
          : `A ${player(derived.leader).name} le faltan ${game.mission.instantWinLead - derived.margin} PV de ventaja`);
  const roundAnnouncement = derived.supply === 'UNLIMITED'
    ? (en ? `Round ${game.currentRound} of ${game.mission.gameLength}. Unlimited supply.` : `Ronda ${game.currentRound} de ${game.mission.gameLength}. Suministro ilimitado.`)
    : (en ? `Round ${game.currentRound} of ${game.mission.gameLength}. Supply for this round: ${derived.supply}.` : `Ronda ${game.currentRound} de ${game.mission.gameLength}. Suministro de esta ronda: ${derived.supply}.`);
  const scorePrefix = en
    ? `${player(1).name}, ${player(1).victoryPoints} VP. ${player(2).name}, ${player(2).victoryPoints} VP.`
    : `${player(1).name}, ${player(1).victoryPoints} PV. ${player(2).name}, ${player(2).victoryPoints} PV.`;
  const scoreAnnouncement = finalized
    ? officialWinner === null
      ? `${scorePrefix} ${en ? 'Final result: draw.' : 'Resultado final: empate.'}`
      : `${scorePrefix} ${en ? 'Winner' : 'Ganador'}: ${player(officialWinner).name}. ${en ? `Margin ${derived.margin} VP.` : `Margen ${derived.margin} PV.`}`
    : derived.leader === null
      ? `${scorePrefix} ${en ? 'Draw.' : 'Empate.'}`
      : `${scorePrefix} ${player(derived.leader).name} ${en ? `leads by ${derived.margin} VP.` : `lidera por ${derived.margin} PV.`}`;
  const undoHintId = 'game-undo-hint';
  const statusLabel = game.status === 'ACTIVE'
    ? (en ? 'In progress' : 'En curso')
    : game.status === 'FINISHED'
      ? (en ? 'Finished' : 'Finalizada')
      : game.status === 'ABANDONED'
        ? (en ? 'Abandoned' : 'Abandonada')
        : (en ? 'Configuration' : 'Configuración');

  return <section className="game-panel game-board" aria-labelledby="game-board-title" aria-busy={pending}>
    <header className="game-board__utility">
      <button className="button-link game-board__back" type="button" onClick={onBack}>{en ? '← Games' : '← Partidas'}</button>
      <div className="game-board__context">
        <p className="game-eyebrow">{game.mission.name}</p>
        <p>{missionScale} · {game.pointsLimit} {en ? 'points' : 'puntos'}</p>
      </div>
      <span className={`game-status game-status--${game.status.toLowerCase()}`}>{statusLabel}</span>
    </header>

    <div className="game-board__arena">
      <section className="game-match-state" aria-label={en ? 'Current game state' : 'Estado actual de la partida'}>
        <div className="game-state-metrics">
          <div className="game-state-metric game-state-metric--round">
            <span className="game-state-metric__label">{en ? 'Current round' : 'Ronda actual'}</span>
            <h1 id="game-board-title" aria-label={en ? `Round ${game.currentRound} of ${game.mission.gameLength}` : `Ronda ${game.currentRound} de ${game.mission.gameLength}`}>
              <strong>{game.currentRound}</strong><small>{en ? 'of' : 'de'} {game.mission.gameLength}</small>
            </h1>
          </div>
          <div className="game-state-metric game-state-metric--supply" data-unlimited={derived.supply === 'UNLIMITED' ? 'true' : undefined}>
            <span className="game-state-metric__label">{en ? 'Supply this round' : 'Suministro de esta ronda'}</span>
            <div className="game-supply-readout"><strong>{supplyDisplay}</strong><small>{derived.supply === 'UNLIMITED' ? (en ? 'Unlimited' : 'Ilimitado') : (en ? 'supply' : 'suministro')}</small></div>
          </div>
        </div>
        <div className="game-supply-context">
          <strong>{nextSupplyLabel}</strong>
          <span>{supplyContextDetail}</span>
        </div>
        <div className="game-margin" data-leading={derived.leader === null ? undefined : 'true'}>
          <span className="game-state-metric__label">{en ? 'Victory margin' : 'Margen de victoria'}</span>
          <strong title={marginTitle}>{marginTitle}</strong>
          <span>{marginDetail}</span>
          {specialVictoryDetail && <small>{specialVictoryDetail}</small>}
        </div>
        {derived.instantVictory && !locked && <div className="game-alert" role="status">
          <span className="game-alert__long">{en
            ? `Special victory! ${player(derived.leader!).name} has a ${derived.margin} VP lead (threshold: ${game.mission.instantWinLead}). Check the score and finish the game.`
            : `¡Victoria especial! ${player(derived.leader!).name} alcanza ${derived.margin} PV de ventaja (umbral: ${game.mission.instantWinLead}). Revisa los PV y finaliza la partida.`}</span>
          <span className="game-alert__compact" aria-hidden="true">{en
            ? `Special victory · ${player(derived.leader!).name} +${derived.margin} VP`
            : `Victoria especial · ${player(derived.leader!).name} +${derived.margin} PV`}</span>
        </div>}
      </section>

      {([1, 2] as const).map((slot) => <PlayerScoreCard
        key={slot}
        en={en}
        slot={slot}
        player={player(slot)}
        leading={(finalized ? officialWinner : derived.leader) === slot}
        pending={pending}
        locked={locked}
        onCommand={onCommand}
      />)}
    </div>

    <p className="sr-only" aria-live="polite" aria-atomic="true">{roundAnnouncement}</p>
    <p className="sr-only" aria-live="polite" aria-atomic="true">{scoreAnnouncement}</p>

    <footer className="game-board__controls">
      {!locked ? <>
        <div className="game-round-actions">
          {derived.instantVictory
            ? <button className="button-primary" type="button" disabled={pending} onClick={onFinalize}>{en ? 'Finish by special victory' : 'Finalizar por victoria especial'}</button>
            : game.currentRound < game.mission.gameLength
              ? <button className="button-primary" type="button" disabled={pending} onClick={() => onCommand({ type: 'ADVANCE_ROUND' })}>
                {en ? `Advance to round ${game.currentRound + 1}` : `Avanzar a ronda ${game.currentRound + 1}`}
              </button>
              : <button className="button-primary" type="button" disabled={pending} onClick={onFinalize}>{en ? 'Finish game' : 'Finalizar partida'}</button>}
          <button
            className="button-secondary"
            type="button"
            disabled={pending || game.currentRound <= 1}
            aria-label={game.currentRound <= 1
              ? (en ? 'Already in the first round. Victory points will not change.' : 'Ya estás en la primera ronda. Los puntos de victoria no cambiarán.')
              : (en ? `Return to round ${game.currentRound - 1}. Victory points will not change.` : `Volver a la ronda ${game.currentRound - 1}. Los puntos de victoria no cambiarán.`)}
            aria-describedby={undoHintId}
            onClick={() => onCommand({ type: 'UNDO_ROUND' })}
          >{en ? 'Undo round' : 'Deshacer ronda'}</button>
        </div>
        <p className="game-undo-hint" id={undoHintId}>{en ? 'Undo changes only the round and supply; victory points stay unchanged.' : 'Deshacer solo corrige la ronda y el suministro; los PV no cambian.'}</p>
      </> : <p className="game-finished-note">{finalized
        ? (en ? 'This session is finished and locked.' : 'Esta sesión está finalizada y bloqueada.')
        : (en ? 'This session is closed and cannot be edited.' : 'Esta sesión está cerrada y no se puede editar.')}</p>}
    </footer>

    <details className="game-mission-rules">
      <summary>{en ? 'View mission rules' : 'Consultar reglas de la misión'}</summary>
      <div className="game-mission-rules__content">
        <div><strong>{en ? 'Parameters' : 'Parámetros'}</strong><p>{localized(game.mission.missionParameters, en)}</p></div>
        <div><strong>{en ? 'Scoring' : 'Puntuación'}</strong><p>{localized(game.mission.scoringConditions, en)}</p></div>
        <div><strong>{en ? 'Additional conditions' : 'Condiciones adicionales'}</strong><p>{localized(game.mission.additionalConditions, en)}</p></div>
      </div>
    </details>

    {finalized && mode === 'account' && !game.linkedMatchRecordId && compatibleLists.length > 0 && <LinkHistoryPanel en={en} game={game} lists={compatibleLists} pending={pending} onLink={onLink} />}
  </section>;
}

function PlayerScoreCard({ en, slot, player, leading, pending, locked, onCommand }: {
  en: boolean;
  slot: GamePlayerSlot;
  player: GameSession['players'][number];
  leading: boolean;
  pending: boolean;
  locked: boolean;
  onCommand: (command: GameCommand) => void;
}) {
  const titleId = `game-player-${slot}-title`;
  const floorHintId = `game-player-${slot}-vp-floor`;
  return <article
    className={`game-player-card game-player-card--${slot}`}
    data-race={player.race}
    data-leading={leading ? 'true' : undefined}
    aria-labelledby={titleId}
  >
    <header className="game-player-card__identity">
      <img src={raceLogo(player.race)} width="44" height="44" alt="" />
      <div>
        <span className="game-player-card__slot">{en ? `Player ${slot}` : `Jugador ${slot}`} · {RACE_LABEL[player.race]}</span>
        <h2 id={titleId} title={player.name}>{player.name}</h2>
      </div>
    </header>
    <div className="game-vp-readout" aria-label={en ? `${player.victoryPoints} victory points` : `${player.victoryPoints} puntos de victoria`}>
      <strong className="game-vp">{player.victoryPoints}</strong><span>{en ? 'VP' : 'PV'}</span>
    </div>
    <div className="game-vp-actions" role="group" aria-label={en ? `Change victory points for ${player.name}` : `Modificar puntos de victoria de ${player.name}`}>
      <button
        type="button"
        aria-label={`${en ? 'Subtract one victory point from' : 'Restar un punto de victoria a'} ${player.name}`}
        aria-describedby={floorHintId}
        disabled={pending || locked || player.victoryPoints === 0}
        onClick={() => onCommand({ type: 'SUBTRACT_VP', slot })}
      >−1</button>
      <button
        type="button"
        aria-label={`${en ? 'Add one victory point to' : 'Sumar un punto de victoria a'} ${player.name}`}
        disabled={pending || locked}
        onClick={() => onCommand({ type: 'ADD_VP', slot })}
      >+1</button>
    </div>
    <span className="sr-only" id={floorHintId}>{en ? 'Victory points cannot go below zero.' : 'Los puntos de victoria no pueden bajar de cero.'}</span>
  </article>;
}

function LinkHistoryPanel({ en, game, lists, pending, onLink }: { en: boolean; game: GameSession; lists: RemoteList[]; pending: boolean; onLink: (listId: string, slot: 1 | 2) => void }) {
  const [slot, setSlot] = useState<1 | 2>(1);
  const compatible = lists.filter((list) => list.race === game.players[slot - 1]!.race);
  const [listId, setListId] = useState(compatible[0]?.id ?? '');
  useEffect(() => { setListId(compatible[0]?.id ?? ''); }, [slot, lists]);
  return <div className="game-history-link"><strong>{en ? 'Add this result to a list history' : 'Añadir este resultado al historial de una lista'}</strong><p className="muted small">{en ? 'This is optional and does not change the list.' : 'Es opcional y no modifica la lista.'}</p><div className="game-history-link__fields"><label className="field"><span>{en ? 'Your player' : 'Tu jugador'}</span><select value={slot} onChange={(event) => setSlot(Number(event.target.value) as 1 | 2)}><option value="1">{game.players[0]!.name} · {RACE_LABEL[game.players[0]!.race]}</option><option value="2">{game.players[1]!.name} · {RACE_LABEL[game.players[1]!.race]}</option></select></label><label className="field"><span>{en ? 'Saved list' : 'Lista guardada'}</span><select value={listId} onChange={(event) => setListId(event.target.value)}>{compatible.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label><button className="button-secondary" disabled={pending || !listId} onClick={() => onLink(listId, slot)}>{en ? 'Add to history' : 'Añadir al historial'}</button></div></div>;
}
