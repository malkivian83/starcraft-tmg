import { z } from 'zod';

/**
 * Esquemas de validación del catálogo y de las listas importadas.
 * Un solo esquema para dos usos: verificar los datos en construcción y
 * rechazar ficheros de importación corruptos.
 */

const localized = z.object({ es: z.string(), en: z.string() });
const properName = z.string().min(1);
const seedId = z.number().int().positive();

const slotType = z.enum(['CORE', 'ELITE', 'SUPPORT', 'AIR', 'HERO']);
const race = z.enum(['ZERG', 'TERRAN', 'PROTOSS']);
const resourceType = z.enum(['CP', 'BM', 'PE']);
const scaleId = z.enum(['skirmish', 'standard', 'grand_offensive']);
const phase = z.enum(['MOVEMENT', 'ASSAULT', 'COMBAT', 'ANY']);

const slotPool = z.record(slotType, z.number().int().nonnegative());

const weapon = z.object({
  name: properName,
  phase,
  range: z.string(),
  target: z.string(),
  rateOfAttack: z.string(),
  hit: z.string(),
  surgeType: z.string().nullable(),
  surgeDice: z.string().nullable(),
  damage: z.string(),
  keywords: z.array(z.string()),
});

const ability = z.object({
  name: properName,
  phase,
  type: z.enum(['ACTIVE', 'PASSIVE', 'REACTION']),
  cost: z.number().int().nonnegative().nullable(),
  text: localized,
  fromUpgrade: z.boolean(),
});

const unitProfile = z.object({
  size: z.string(),
  hitPoints: z.string(),
  evade: z.string(),
  armour: z.string(),
  speed: z.string(),
  shield: z.string().nullable(),
});

export const engagementScaleSchema = z.object({
  id: scaleId,
  name: localized,
  mineralLimit: z.number().int().positive().nullable(),
  mineralMinimum: z.number().int().nonnegative(),
  vespeneRatio: z.number().positive(),
  battlefield: z.string(),
});

export const factionCardSchema = z.object({
  id: z.string(),
  seedId,
  race,
  name: properName,
  tags: z.array(z.string()).min(1),
  startingSlots: slotPool,
  resource: resourceType,
  resourcePerRound: z.number().int().nonnegative(),
  abilities: z.array(ability),
  imageRef: z.string().optional(),
});

export const tacticalCardSchema = z.object({
  id: z.string(),
  seedId,
  race,
  name: properName,
  tags: z.array(z.string()).min(1),
  vespeneCost: z.number().int().nonnegative(),
  slotsGranted: slotPool,
  unique: z.boolean(),
  resource: resourceType.nullable(),
  resourcePerRound: z.number().int().nonnegative(),
  abilities: z.array(ability),
  imageRef: z.string().optional(),
});

export const creepCardSchema = z.object({
  id: z.string(),
  seedId,
  race: z.literal('ZERG'),
  name: properName,
  tags: z.array(z.string()).min(1),
  vespeneCost: z.number().int().nonnegative(),
  unique: z.boolean(),
  abilities: z.array(ability),
  imageRef: z.string().optional(),
});

export const unitCardSchema = z.object({
  id: z.string(),
  race,
  name: properName,
  baseSize: z.string(),
  profile: unitProfile,
  weapons: z.array(weapon),
  abilities: z.array(ability),
  supplyProfile: z.array(
    z.object({
      minModels: z.number().int().positive(),
      maxModels: z.number().int().positive(),
      supply: z.number().int().nonnegative(),
    }),
  ),
  imageRefFront: z.string().optional(),
  imageRefBack: z.string().optional(),
  miniRef: z.string().optional(),
});

export const upgradeOptionSchema = z.object({
  id: z.string(),
  seedId,
  name: properName,
  specialist: z.boolean(),
  replacesWeapon: properName.nullable(),
  costByComposition: z.record(z.string(), z.number().int().nonnegative()),
  grantsWeapons: z.array(weapon),
  grantsAbilities: z.array(ability),
  text: localized.optional(),
});

export const unitEntrySchema = z.object({
  id: z.string(),
  seedId,
  cardId: z.string(),
  race,
  name: properName,
  tags: z.array(z.string()).min(1),
  slotType,
  combatRole: localized,
  unique: z.boolean(),
  summoned: z.boolean(),
  compositions: z
    .array(
      z.object({
        id: z.string(),
        models: z.number().int().positive(),
        mineralCost: z.number().int().nonnegative(),
        supplyValue: z.number().int().nonnegative(),
      }),
    )
    .min(1),
  upgrades: z.array(upgradeOptionSchema),
});

export const missionCardSchema = z.object({
  id: z.string(),
  seedId,
  name: properName,
  scale: scaleId,
  startingSupply: z.number().int().nonnegative(),
  supplyEscalation: z.number().int().nonnegative(),
  gameLength: z.number().int().positive(),
  missionParameters: localized,
  scoringConditions: localized,
  additionalConditions: localized,
  instantWinLead: z.number().int().positive().nullable(),
  imageRef: z.string().optional(),
});

export const deploymentCardSchema = z.object({
  id: z.string(),
  seedId,
  name: properName,
  scale: scaleId,
  battlefield: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  // Obligatorio: el diagrama de marcadores ES la carta (hallazgo M4).
  imageRef: z.string().min(1),
  notes: localized.optional(),
});

/**
 * Texto de una mejora, compartido por todas las unidades que la ofrecen.
 *
 * `Burrow Ambush` existe en siete unidades Zerg con el mismo efecto pero
 * distinto coste. El coste vive en cada unidad —es lo que cambia—, y el texto
 * aquí: repetirlo siete veces obligaría a corregir una errata siete veces, y
 * olvidar una dejaría el catálogo diciendo dos cosas distintas.
 */
export const upgradeGlossaryEntrySchema = z.object({
  phase,
  type: z.enum(['ACTIVE', 'PASSIVE', 'REACTION']),
  cost: z.number().int().nonnegative().nullable(),
  text: localized,
  /** Arma que otorga la mejora, si sustituye o añade uno. */
  weapon: weapon.optional(),
});

export const raceCatalogSchema = z.object({
  schemaVersion: z.string(),
  contentVersion: z.string(),
  sourceRef: z.string(),
  race,
  upgradeGlossary: z.record(z.string(), upgradeGlossaryEntrySchema).optional(),
  factionCards: z.array(factionCardSchema),
  tacticalCards: z.array(tacticalCardSchema),
  creepCards: z.array(creepCardSchema),
  unitCards: z.array(unitCardSchema),
  unitEntries: z.array(unitEntrySchema),
});

export const coreCatalogSchema = z.object({
  schemaVersion: z.string(),
  contentVersion: z.string(),
  sourceRef: z.string(),
  scales: z.array(engagementScaleSchema).min(1),
});

export const scenarioCatalogSchema = z.object({
  schemaVersion: z.string(),
  contentVersion: z.string(),
  sourceRef: z.string(),
  missionCards: z.array(missionCardSchema).min(1),
  deploymentCards: z.array(deploymentCardSchema).min(1),
});

// --- Listas del usuario -----------------------------------------------------

export const appliedUpgradeSchema = z.object({
  upgradeId: z.string(),
  modelIndex: z.number().int().nonnegative().nullable(),
});

export const listEntrySchema = z.object({
  instanceId: z.string(),
  unitEntryId: z.string(),
  compositionId: z.string(),
  upgrades: z.array(appliedUpgradeSchema),
  customLabel: z.string().optional(),
  reference: z.boolean(),
});

export const armyListSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  catalogContentVersion: z.string(),
  schemaVersion: z.string(),
  race,
  scaleId,
  mineralLimit: z.number().int().positive(),
  factionCardId: z.string().nullable(),
  tacticalCardIds: z.array(z.string()),
  creepCardId: z.string().nullable(),
  entries: z.array(listEntrySchema),
  missionCardIds: z.array(z.string()),
  deploymentCardIds: z.array(z.string()),
  notes: z.string().optional(),
});

export type RaceCatalogData = z.infer<typeof raceCatalogSchema>;
export type CoreCatalogData = z.infer<typeof coreCatalogSchema>;
export type ScenarioCatalogData = z.infer<typeof scenarioCatalogSchema>;
