import { z } from 'zod';

export const matchResultSchema = z.enum(['WIN', 'LOSS', 'DRAW']);
export const matchRaceSchema = z.enum(['ZERG', 'TERRAN', 'PROTOSS']);

/** Cuerpo aceptado en POST y PUT. Todo es opcional salvo el resultado. */
export const matchRecordInputSchema = z.object({
  result: matchResultSchema,
  playedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  opponentRace: matchRaceSchema.nullable().default(null),
  opponentFactionCardId: z.string().trim().min(1).max(64).nullable().default(null),
  opponentName: z.string().trim().max(80).nullable().default(null),
}).transform((value) => ({
  ...value,
  opponentName: value.opponentName === '' ? null : value.opponentName,
}));

export type MatchRecordInput = z.infer<typeof matchRecordInputSchema>;
