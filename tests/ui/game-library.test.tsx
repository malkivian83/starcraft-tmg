import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RemoteList } from '@/auth/listService';
import { createGameSession, type GameSession } from '@/engine/gameSession';
import type { MissionCard } from '@/engine/types';
import { LibraryView } from '@/ui/game/GamePage';

const NOW = '2026-08-23T10:38:00.000Z';
const LIST_ID = '10000000-0000-4000-8000-000000000001';

const mission: MissionCard = {
  id: 'mission.hold-position.standard',
  seedId: 1,
  name: 'Hold Position',
  scale: 'standard',
  startingSupply: 3,
  supplyEscalation: 1,
  gameLength: 5,
  missionParameters: { es: 'Parámetros', en: 'Parameters' },
  scoringConditions: { es: 'Puntuación', en: 'Scoring' },
  additionalConditions: { es: 'Condiciones', en: 'Conditions' },
  instantWinLead: 8,
};

function finishedGame(linkedListId: string | null = LIST_ID): GameSession {
  const game = createGameSession('00000000-0000-4000-8000-000000000001', 'ACCOUNT', {
    pointsLimit: 1000,
    mission,
    players: [
      { name: 'Fede', race: 'ZERG' },
      { name: 'Josema', race: 'TERRAN' },
    ],
  }, NOW);
  return {
    ...game,
    status: 'FINISHED',
    currentRound: 5,
    players: [
      { ...game.players[0], victoryPoints: 9 },
      { ...game.players[1], victoryPoints: 7 },
    ],
    winnerPlayerSlot: 1,
    finishReason: 'ROUNDS_COMPLETE',
    ownerPlayerSlot: linkedListId ? 1 : null,
    linkedListId,
    linkedMatchRecordId: linkedListId ? '20000000-0000-4000-8000-000000000001' : null,
    finishedAt: NOW,
  };
}

const linkedList: RemoteList = {
  id: LIST_ID,
  name: 'Enjambre de Fede',
  createdAt: NOW,
  updatedAt: NOW,
  catalogContentVersion: '2026.05.1.2',
  schemaVersion: '1.0.0',
  race: 'ZERG',
  scaleId: 'standard',
  mineralLimit: 1000,
  factionCardId: 'zerg.faction.zerg_swarm',
  tacticalCardIds: [],
  creepCardId: null,
  entries: [],
  missionCardIds: [],
  deploymentCardIds: [],
  revision: 1,
  remoteUpdatedAt: NOW,
  isPublic: false,
  publishedAt: null,
  ownerNickname: 'Fede',
  ownerAvatar: null,
  likeCount: 0,
  likedByCurrentUser: false,
};

function renderLibrary(game: GameSession, lists: RemoteList[]): string {
  return renderToStaticMarkup(<LibraryView
    en={false}
    mode="account"
    games={[game]}
    guestGames={[]}
    lists={lists}
    pending={false}
    onClaim={() => undefined}
    onNew={() => undefined}
    onOpen={() => undefined}
    onDelete={() => undefined}
  />);
}

describe('biblioteca de partidas', () => {
  it('destaca facciones, jugadores y PV en filas separadas', () => {
    const html = renderLibrary(finishedGame(), [linkedList]);

    expect(html).toContain('data-race="ZERG"');
    expect(html).toContain('data-race="TERRAN"');
    expect(html).toContain('Jugador 1 · Zerg');
    expect(html).toContain('Jugador 2 · Terran');
    expect(html).toContain('>Fede</strong>');
    expect(html).toContain('>Josema</strong>');
    expect(html).toContain('>9</strong><span>PV</span>');
    expect(html).toContain('>7</strong><span>PV</span>');
    expect(html).toContain('>Ganador</span>');
    expect(html).toContain('Hold Position');
    expect(html).toContain('Estándar · 1000 puntos');
    expect(html).toContain('Ronda 5/5');
  });

  it('muestra y enlaza la lista concreta asociada', () => {
    const html = renderLibrary(finishedGame(), [linkedList]);

    expect(html).toContain(`href="/es/nueva-lista?list=${LIST_ID}"`);
    expect(html).toContain('Lista asociada de Fede');
    expect(html).toContain('Enjambre de Fede');
    expect(html).toContain('Zerg · Zerg Swarm');
  });

  it('no inventa un enlace cuando no hay lista asociada', () => {
    const html = renderLibrary(finishedGame(null), [linkedList]);

    expect(html).not.toContain('game-card__linked-list');
    expect(html).not.toContain('?list=');
  });

  it('mantiene el enlace aunque la ficha de la lista todavía no se haya cargado', () => {
    const html = renderLibrary(finishedGame(), []);

    expect(html).toContain(`href="/es/nueva-lista?list=${LIST_ID}"`);
    expect(html).toContain('Abrir lista asociada');
  });
});
