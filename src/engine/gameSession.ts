import { z } from 'zod';
import type { MissionCard, Race } from './types';

export type GamePlayerSlot = 1 | 2;
export type GameSessionStatus = 'CONFIGURATION' | 'ACTIVE' | 'FINISHED' | 'ABANDONED';
export type GameFinishReason = 'ROUNDS_COMPLETE' | 'SPECIAL_VICTORY' | 'CONCESSION' | 'OTHER' | 'DRAW';
export type GameCommand =
  | { type: 'ADD_VP'; slot: GamePlayerSlot }
  | { type: 'SUBTRACT_VP'; slot: GamePlayerSlot }
  | { type: 'ADVANCE_ROUND' }
  | { type: 'UNDO_ROUND' }
  | { type: 'FINALIZE'; winnerPlayerSlot: GamePlayerSlot | null; finishReason: GameFinishReason }
  | { type: 'ABANDON' };

export interface GameMissionSnapshot {
  id: string;
  name: string;
  scale: 'skirmish' | 'standard' | 'grand_offensive';
  startingSupply: number;
  supplyEscalation: number;
  gameLength: number;
  instantWinLead: number | null;
  missionParameters: { es: string; en: string };
  scoringConditions: { es: string; en: string };
  additionalConditions: { es: string; en: string };
}

export interface GamePlayer {
  name: string;
  race: Race;
  victoryPoints: number;
}

export interface GameSession {
  id: string;
  status: GameSessionStatus;
  ownerType: 'ACCOUNT' | 'GUEST';
  originType: 'ACCOUNT' | 'GUEST';
  pointsLimit: number;
  mission: GameMissionSnapshot;
  currentRound: number;
  players: [GamePlayer, GamePlayer];
  winnerPlayerSlot: GamePlayerSlot | null;
  finishReason: GameFinishReason | null;
  ownerPlayerSlot: GamePlayerSlot | null;
  linkedListId: string | null;
  linkedMatchRecordId: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export interface GameSessionDraft {
  pointsLimit: number;
  mission: MissionCard;
  players: [{ name: string; race: Race }, { name: string; race: Race }];
}

export interface GameDerivedState {
  supply: number | 'UNLIMITED';
  nextSupply: number | 'UNLIMITED' | null;
  margin: number;
  signedMargin: number;
  leader: GamePlayerSlot | null;
  instantVictory: boolean;
}

const raceSchema = z.enum(['ZERG', 'TERRAN', 'PROTOSS']);
const playerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  race: raceSchema,
  victoryPoints: z.number().int().nonnegative(),
});

export const gameMissionSnapshotSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  scale: z.enum(['skirmish', 'standard', 'grand_offensive']),
  startingSupply: z.number().int().nonnegative(),
  supplyEscalation: z.number().int().nonnegative(),
  gameLength: z.number().int().positive(),
  instantWinLead: z.number().int().positive().nullable(),
  missionParameters: z.object({ es: z.string(), en: z.string() }),
  scoringConditions: z.object({ es: z.string(), en: z.string() }),
  additionalConditions: z.object({ es: z.string(), en: z.string() }),
});

export const gameSessionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['CONFIGURATION', 'ACTIVE', 'FINISHED', 'ABANDONED']),
  ownerType: z.enum(['ACCOUNT', 'GUEST']),
  originType: z.enum(['ACCOUNT', 'GUEST']),
  pointsLimit: z.number().int().positive(),
  mission: gameMissionSnapshotSchema,
  currentRound: z.number().int().min(1),
  players: z.tuple([playerSchema, playerSchema]),
  winnerPlayerSlot: z.union([z.literal(1), z.literal(2)]).nullable(),
  finishReason: z.enum(['ROUNDS_COMPLETE', 'SPECIAL_VICTORY', 'CONCESSION', 'OTHER', 'DRAW']).nullable(),
  ownerPlayerSlot: z.union([z.literal(1), z.literal(2)]).nullable(),
  linkedListId: z.string().uuid().nullable(),
  linkedMatchRecordId: z.string().uuid().nullable(),
  revision: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  finishedAt: z.string().nullable(),
});

function snapshotMission(mission: MissionCard): GameMissionSnapshot {
  return {
    id: mission.id,
    name: mission.name,
    scale: mission.scale,
    startingSupply: mission.startingSupply,
    supplyEscalation: mission.supplyEscalation,
    gameLength: mission.gameLength,
    instantWinLead: mission.instantWinLead,
    missionParameters: mission.missionParameters,
    scoringConditions: mission.scoringConditions,
    additionalConditions: mission.additionalConditions,
  };
}

export function createGameSession(id: string, ownerType: 'ACCOUNT' | 'GUEST', draft: GameSessionDraft, now = new Date().toISOString()): GameSession {
  if (!Number.isInteger(draft.pointsLimit) || draft.pointsLimit <= 0) throw new Error('pointsLimit must be a positive integer');
  if (!draft.players[0].name.trim() || !draft.players[1].name.trim()) throw new Error('Both player names are required');
  return {
    id,
    status: 'ACTIVE',
    ownerType,
    originType: ownerType,
    pointsLimit: draft.pointsLimit,
    mission: snapshotMission(draft.mission),
    currentRound: 1,
    players: [
      { name: draft.players[0].name.trim(), race: draft.players[0].race, victoryPoints: 0 },
      { name: draft.players[1].name.trim(), race: draft.players[1].race, victoryPoints: 0 },
    ],
    winnerPlayerSlot: null,
    finishReason: null,
    ownerPlayerSlot: null,
    linkedListId: null,
    linkedMatchRecordId: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
    finishedAt: null,
  };
}

export function supplyForRound(mission: Pick<GameMissionSnapshot, 'startingSupply' | 'supplyEscalation' | 'gameLength'>, round: number): number | 'UNLIMITED' {
  if (round < 1 || round > mission.gameLength) throw new Error('Round is outside mission length');
  return round === mission.gameLength ? 'UNLIMITED' : mission.startingSupply + mission.supplyEscalation * (round - 1);
}

export function deriveGameState(session: Pick<GameSession, 'mission' | 'currentRound' | 'players'>): GameDerivedState {
  const signedMargin = session.players[0].victoryPoints - session.players[1].victoryPoints;
  return {
    supply: supplyForRound(session.mission, session.currentRound),
    nextSupply: session.currentRound >= session.mission.gameLength ? null : supplyForRound(session.mission, session.currentRound + 1),
    margin: Math.abs(signedMargin),
    signedMargin,
    leader: signedMargin === 0 ? null : signedMargin > 0 ? 1 : 2,
    instantVictory: session.mission.instantWinLead !== null && Math.abs(signedMargin) >= session.mission.instantWinLead,
  };
}

export function updateVictoryPoints(session: GameSession, slot: GamePlayerSlot, delta: 1 | -1, now = new Date().toISOString()): GameSession {
  if (session.status !== 'ACTIVE') throw new Error('Finished games cannot be edited');
  const index = slot - 1;
  const players: [GamePlayer, GamePlayer] = [...session.players] as [GamePlayer, GamePlayer];
  const current = players[index]!;
  players[index] = { ...current, victoryPoints: Math.max(0, current.victoryPoints + delta) };
  return { ...session, players, revision: session.revision + 1, updatedAt: now };
}

export function advanceRound(session: GameSession, now = new Date().toISOString()): GameSession {
  if (session.status !== 'ACTIVE') throw new Error('Only active games can advance');
  if (session.currentRound >= session.mission.gameLength) throw new Error('The game is already in its final round');
  return { ...session, currentRound: session.currentRound + 1, revision: session.revision + 1, updatedAt: now };
}

export function undoRound(session: GameSession, now = new Date().toISOString()): GameSession {
  if (session.status !== 'ACTIVE') throw new Error('Only active games can undo');
  if (session.currentRound <= 1) throw new Error('The game is already in round one');
  return { ...session, currentRound: session.currentRound - 1, revision: session.revision + 1, updatedAt: now };
}

export function finishGame(session: GameSession, winnerPlayerSlot: GamePlayerSlot | null, finishReason: GameFinishReason, now = new Date().toISOString()): GameSession {
  if (session.status !== 'ACTIVE') throw new Error('Only active games can finish');
  if (winnerPlayerSlot === null && finishReason !== 'DRAW') throw new Error('A non-draw result needs a winner');
  if (winnerPlayerSlot !== null && finishReason === 'DRAW') throw new Error('A draw cannot have a winner');
  return {
    ...session,
    status: 'FINISHED',
    winnerPlayerSlot,
    finishReason,
    finishedAt: now,
    revision: session.revision + 1,
    updatedAt: now,
  };
}
