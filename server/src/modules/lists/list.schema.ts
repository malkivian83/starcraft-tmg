import { z } from 'zod';

const raceSchema = z.enum(['ZERG', 'TERRAN', 'PROTOSS']);

export const armyListPayloadSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  catalogContentVersion: z.string().min(1).max(64),
  schemaVersion: z.string().min(1).max(64),
  race: raceSchema,
  scaleId: z.enum(['skirmish', 'standard', 'grand_offensive']),
  mineralLimit: z.number().int().positive(),
  factionCardId: z.string().nullable(),
  tacticalCardIds: z.array(z.string()),
  creepCardId: z.string().nullable(),
  entries: z.array(z.object({
    instanceId: z.string().uuid(),
    unitEntryId: z.string().min(1),
    compositionId: z.string().min(1),
    upgrades: z.array(z.object({ upgradeId: z.string().min(1), modelIndex: z.number().int().nonnegative().nullable() })),
    customLabel: z.string().max(160).optional(),
    reference: z.boolean(),
  })),
  missionCardIds: z.array(z.string()),
  deploymentCardIds: z.array(z.string()),
  notes: z.string().max(5000).optional(),
});

export type ArmyListPayload = z.infer<typeof armyListPayloadSchema>;
