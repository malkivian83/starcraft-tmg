import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { RemoteList } from '@/auth/listService';
import { createGameSession, type GameSession } from '@/engine/gameSession';
import type { MissionCard, Race } from '@/engine/types';
import { BoardView } from '@/ui/game/GamePage';

const NOW = '2026-08-22T10:00:00.000Z';

const mission: MissionCard = {
  id: 'mission.test.standard',
  seedId: 1,
  name: 'Test Mission',
  scale: 'standard',
  startingSupply: 6,
  supplyEscalation: 2,
  gameLength: 5,
  missionParameters: { es: 'Parámetros', en: 'Parameters' },
  scoringConditions: { es: 'Puntuación', en: 'Scoring' },
  additionalConditions: { es: 'Condiciones', en: 'Conditions' },
  instantWinLead: 10,
};

function session(overrides: Partial<GameSession> = {}): GameSession {
  const base = createGameSession('00000000-0000-4000-8000-000000000001', 'GUEST', {
    pointsLimit: 1500,
    mission,
    players: [
      { name: 'Alpha', race: 'ZERG' },
      { name: 'Beta', race: 'TERRAN' },
    ],
  }, NOW);
  return { ...base, ...overrides };
}

function withScore(game: GameSession, playerOne: number, playerTwo: number): GameSession {
  const players: GameSession['players'] = [
    { ...game.players[0], victoryPoints: playerOne },
    { ...game.players[1], victoryPoints: playerTwo },
  ];
  return { ...game, players };
}

function remoteList(race: Race): RemoteList {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Lista compatible',
    createdAt: NOW,
    updatedAt: NOW,
    catalogContentVersion: '2026.05.1.2',
    schemaVersion: '1.0.0',
    race,
    scaleId: 'standard',
    mineralLimit: 1500,
    factionCardId: null,
    tacticalCardIds: [],
    creepCardId: null,
    entries: [],
    missionCardIds: [],
    deploymentCardIds: [],
    revision: 1,
    remoteUpdatedAt: NOW,
    isPublic: false,
    publishedAt: null,
    ownerNickname: 'Tester',
    ownerAvatar: null,
    likeCount: 0,
    likedByCurrentUser: false,
  };
}

function renderBoard(game: GameSession, options: { mode?: 'guest' | 'account'; lists?: RemoteList[] } = {}): string {
  return renderToStaticMarkup(<BoardView
    en={false}
    mode={options.mode ?? 'guest'}
    game={game}
    lists={options.lists ?? []}
    pending={false}
    onCommand={() => undefined}
    onFinalize={() => undefined}
    onLink={() => undefined}
    onBack={() => undefined}
  />);
}

function occurrences(value: string, fragment: string): number {
  return value.split(fragment).length - 1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buttonByLabel(html: string, label: string): string {
  const match = html.match(new RegExp(`<button[^>]*aria-label="${escapeRegExp(label)}"[^>]*>[^<]*</button>`));
  expect(match, `No se encontró el botón con aria-label "${label}"`).not.toBeNull();
  return match![0];
}

function playerCardTag(html: string, slot: 1 | 2): string {
  const match = html.match(new RegExp(`<article class="game-player-card game-player-card--${slot}"[^>]*>`));
  expect(match, `No se encontró la tarjeta del jugador ${slot}`).not.toBeNull();
  return match![0];
}

describe('tablero de partida', () => {
  it('muestra la ronda inicial, suministros, jugadores y controles bloqueados por sus límites', () => {
    const html = renderBoard(withScore(session(), 2, 0));

    expect(html).toContain('aria-label="Ronda 1 de 5"');
    expect(html).toContain('<strong>6</strong><small>suministro</small>');
    expect(html).toContain('Siguiente ronda: 8 de suministro');
    expect(occurrences(html, 'class="game-player-card game-player-card--')).toBe(2);
    expect(playerCardTag(html, 1)).toContain('data-race="ZERG"');
    expect(playerCardTag(html, 2)).toContain('data-race="TERRAN"');
    expect(html).toContain('aria-label="2 puntos de victoria"');
    expect(html).toContain('aria-label="0 puntos de victoria"');

    const subtractAtZero = buttonByLabel(html, 'Restar un punto de victoria a Beta');
    expect(subtractAtZero).toContain('disabled=""');
    const undo = buttonByLabel(html, 'Ya estás en la primera ronda. Los puntos de victoria no cambiarán.');
    expect(undo).toContain('disabled=""');
    expect(html).not.toContain('ronda 0');
  });

  it('avisa en la penúltima ronda de que la siguiente tendrá suministro ilimitado', () => {
    const html = renderBoard(session({ currentRound: 4 }));

    expect(html).toContain('aria-label="Ronda 4 de 5"');
    expect(html).toContain('<strong>12</strong><small>suministro</small>');
    expect(html).toContain('Siguiente ronda: suministro ilimitado');
  });

  it('cambia la llamada principal al alcanzar el umbral especial y oculta el avance', () => {
    const html = renderBoard(withScore(session({ currentRound: 2 }), 10, 0));

    expect(html).toContain('Finalizar por victoria especial');
    expect(html).toContain('¡Victoria especial! Alpha alcanza 10 PV de ventaja');
    expect(html).not.toContain('Avanzar a ronda 3');
  });

  it('muestra suministro infinito y una sola acción de finalizar en la ronda final', () => {
    const html = renderBoard(session({ currentRound: 5 }));

    expect(html).toContain('<strong>∞</strong><small>Ilimitado</small>');
    expect(occurrences(html, 'Finalizar partida')).toBe(1);
    expect(html).not.toContain('Avanzar a ronda');
  });

  it('presenta como ganador al resultado oficial de una partida finalizada', () => {
    const finished: GameSession = {
      ...withScore(session(), 1, 8),
      status: 'FINISHED',
      winnerPlayerSlot: 1,
      finishReason: 'CONCESSION',
      finishedAt: NOW,
    };
    const html = renderBoard(finished, { mode: 'account', lists: [remoteList('ZERG')] });

    expect(playerCardTag(html, 1)).toContain('data-leading="true"');
    expect(playerCardTag(html, 2)).not.toContain('data-leading');
    expect(html).toContain('<strong title="Alpha">Alpha</strong>');
    expect(html).toContain('Ganador · margen 7 PV');
    expect(html).not.toContain('Beta lidera por 7 PV.');
    expect(html).toContain('Añadir este resultado al historial de una lista');
  });

  it('no ofrece asociar al historial una partida abandonada aunque haya una lista compatible', () => {
    const abandoned: GameSession = {
      ...withScore(session(), 3, 1),
      status: 'ABANDONED',
    };
    const html = renderBoard(abandoned, { mode: 'account', lists: [remoteList('ZERG')] });

    expect(html).toContain('Abandonada');
    expect(html).toContain('Esta sesión está cerrada y no se puede editar.');
    expect(html).not.toContain('Añadir este resultado al historial de una lista');
    expect(html).not.toContain('class="game-history-link"');
  });
});
