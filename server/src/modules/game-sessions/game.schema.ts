import { z } from 'zod';

export const raceSchema = z.enum(['ZERG', 'TERRAN', 'PROTOSS']);
export const playerSlotSchema = z.union([z.literal(1), z.literal(2)]);

export const createGameSchema = z.object({
  pointsLimit: z.number().int().positive(),
  missionId: z.string().min(1).max(160),
  players: z.tuple([
    z.object({ name: z.string().trim().min(1).max(80), race: raceSchema }),
    z.object({ name: z.string().trim().min(1).max(80), race: raceSchema }),
  ]),
});

export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ADD_VP'), slot: playerSlotSchema }),
  z.object({ type: z.literal('SUBTRACT_VP'), slot: playerSlotSchema }),
  z.object({ type: z.literal('ADVANCE_ROUND') }),
  z.object({ type: z.literal('UNDO_ROUND') }),
  z.object({
    type: z.literal('FINALIZE'),
    winnerPlayerSlot: playerSlotSchema.nullable(),
    finishReason: z.enum(['ROUNDS_COMPLETE', 'SPECIAL_VICTORY', 'CONCESSION', 'OTHER', 'DRAW']),
  }),
  z.object({ type: z.literal('ABANDON') }),
]);

export const linkListSchema = z.object({
  listId: z.string().uuid(),
  ownerPlayerSlot: playerSlotSchema,
});

export type CreateGameInput = z.infer<typeof createGameSchema>;
export type GameCommand = z.infer<typeof commandSchema>;
export type LinkListInput = z.infer<typeof linkListSchema>;
