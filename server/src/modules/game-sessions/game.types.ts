export type GameRace = 'ZERG' | 'TERRAN' | 'PROTOSS';
export type GamePlayerSlot = 1 | 2;
export type GameStatus = 'CONFIGURATION' | 'ACTIVE' | 'FINISHED' | 'ABANDONED';
export type GameFinishReason = 'ROUNDS_COMPLETE' | 'SPECIAL_VICTORY' | 'CONCESSION' | 'OTHER' | 'DRAW';

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

export interface GameSession {
  id: string;
  status: GameStatus;
  ownerType: 'ACCOUNT' | 'GUEST';
  originType: 'ACCOUNT' | 'GUEST';
  pointsLimit: number;
  mission: GameMissionSnapshot;
  currentRound: number;
  players: [{ name: string; race: GameRace; victoryPoints: number }, { name: string; race: GameRace; victoryPoints: number }];
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
