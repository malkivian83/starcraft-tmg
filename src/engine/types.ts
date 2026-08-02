/**
 * Tipos del dominio. Fuente: docs/03-MODELO-DATOS.md
 *
 * Este fichero no importa nada de React ni del navegador: el motor debe poder
 * ejecutarse y probarse sin renderizar nada (SDD §1).
 */

// ---------------------------------------------------------------------------
// Tipos base
// ---------------------------------------------------------------------------

export type Race = 'ZERG' | 'TERRAN' | 'PROTOSS';

export type SlotType = 'CORE' | 'ELITE' | 'SUPPORT' | 'AIR' | 'HERO';

export const SLOT_TYPES: readonly SlotType[] = [
  'CORE',
  'ELITE',
  'SUPPORT',
  'AIR',
  'HERO',
] as const;

/** Recurso por ronda que aportan las cartas. Depende de la raza. */
export type ResourceType = 'CP' | 'BM' | 'PE';

/** Etiqueta de facción. Determina la elegibilidad (R3). */
export type FactionTag = string;

export type ScaleId = 'skirmish' | 'standard' | 'grand_offensive';

export type SlotPool = Partial<Record<SlotType, number>>;

/**
 * Texto que EXPLICA algo: se traduce al español conservando el original.
 * No usar para nombres propios — para eso está `ProperName`.
 */
export interface Localized {
  es: string;
  en: string;
}

/**
 * Nombre propio: unidades, armas, habilidades, cartas y palabras clave.
 * Se mantiene SIEMPRE en inglés y nunca se traduce (PRD, regla de idioma).
 * El alias existe para que el tipo documente la intención en cada campo.
 */
export type ProperName = string;

/** Identificador numérico permanente usado por el códec de seed (SDD §7.1). */
export type SeedId = number;

// ---------------------------------------------------------------------------
// Perfiles y habilidades
// ---------------------------------------------------------------------------

export type Phase = 'MOVEMENT' | 'ASSAULT' | 'COMBAT' | 'ANY';

export type AbilityType = 'ACTIVE' | 'PASSIVE' | 'REACTION';

export interface Weapon {
  name: ProperName;
  phase: Phase;
  /** Se guarda como texto: "12", "E" (engagement). No se opera con él. */
  range: string;
  target: string;
  rateOfAttack: string;
  hit: string;
  surgeType: string | null;
  surgeDice: string | null;
  damage: string;
  keywords: ProperName[];
}

export interface Ability {
  name: ProperName;
  phase: Phase;
  type: AbilityType;
  /** Coste en CP/BM/PE. `X` representa un coste variable. */
  cost: number | 'X' | null;
  text: Localized;
  fromUpgrade: boolean;
}

export interface UnitProfile {
  /**
   * Todas las características se guardan como TEXTO, tal como están impresas
   * ("4/7", "5+", "—"). Convertirlas a número perdería información y no aporta
   * nada: la aplicación no tira dados. "—" significa "sin transcribir aún".
   */
  size: string;
  hitPoints: string;
  evade: string;
  armour: string;
  speed: string;
  shield: string | null;
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------

export interface EngagementScale {
  id: ScaleId;
  name: Localized;
  /** `null` en Gran Ofensiva: el límite lo fija el usuario. */
  mineralLimit: number | null;
  mineralMinimum: number;
  /** El gas es un ratio (10 %), no un valor fijo: si no, se rompe en Gran Ofensiva. */
  vespeneRatio: number;
  battlefield: string;
}

export interface FactionCard {
  id: string;
  seedId: SeedId;
  race: Race;
  name: ProperName;
  tags: FactionTag[];
  startingSlots: SlotPool;
  resource: ResourceType;
  resourcePerRound: number;
  abilities: Ability[];
  imageRef?: string;
}

export interface TacticalCard {
  id: string;
  seedId: SeedId;
  race: Race;
  name: ProperName;
  tags: FactionTag[];
  vespeneCost: number;
  /** `{}` cuando la carta no otorga espacios (impreso como "SUPPLY: -"). */
  slotsGranted: SlotPool;
  unique: boolean;
  resource: ResourceType | null;
  resourcePerRound: number;
  abilities: Ability[];
  imageRef?: string;
}

/**
 * Tipo propio, no una carta táctica marcada: no otorga espacios y su
 * cardinalidad es exactamente 1 (obligatoria), no 0..n. Ver R11.
 */
export interface CreepCard {
  id: string;
  seedId: SeedId;
  race: 'ZERG';
  name: ProperName;
  tags: FactionTag[];
  vespeneCost: number;
  unique: boolean;
  abilities: Ability[];
  imageRef?: string;
}

export interface SupplyBand {
  minModels: number;
  maxModels: number;
  supply: number;
}

export interface UnitCard {
  id: string;
  race: Race;
  name: ProperName;
  baseSize: string;
  profile: UnitProfile;
  weapons: Weapon[];
  abilities: Ability[];
  supplyProfile: SupplyBand[];
  imageRefFront?: string;
  imageRefBack?: string;
  /** Foto de la miniatura recortada de la hoja de cartas. */
  miniRef?: string;
}

export interface Composition {
  id: string;
  models: number;
  mineralCost: number;
  /** Espacios que ocupa. Del apéndice §12.10, no derivado de `supplyProfile`. */
  supplyValue: number;
}

export interface UpgradeOption {
  id: string;
  seedId: SeedId;
  name: ProperName;
  specialist: boolean;
  /** Arma sustituida si la mejora es un reemplazo ("↑ FOR C-14 Rifle"). */
  replacesWeapon: ProperName | null;
  /**
   * Coste indexado por composición: una mejora cuesta distinto con 6 modelos
   * que con 9 (hallazgo H3). Una composición ausente = mejora no disponible.
   */
  costByComposition: Record<string, number>;
  grantsWeapons: Weapon[];
  grantsAbilities: Ability[];
  text?: Localized;
}

/**
 * Lo que se puede reclutar. Separado de `UnitCard` porque las variantes de
 * cepa (Swarmling, Raptor, Kerrigan Swarm Raptor) comparten perfil pero
 * difieren en etiquetas, costes y composiciones (hallazgo H2).
 */
export interface UnitEntry {
  id: string;
  seedId: SeedId;
  cardId: string;
  race: Race;
  name: ProperName;
  tags: FactionTag[];
  slotType: SlotType;
  combatRole: Localized;
  unique: boolean;
  /** Unidades invocadas (§9.1.9): no cuestan ni ocupan espacios. */
  summoned: boolean;
  compositions: Composition[];
  upgrades: UpgradeOption[];
}

export interface MissionCard {
  id: string;
  seedId: SeedId;
  name: ProperName;
  scale: ScaleId;
  startingSupply: number;
  supplyEscalation: number;
  gameLength: number;
  missionParameters: Localized;
  scoringConditions: Localized;
  additionalConditions: Localized;
  instantWinLead: number | null;
  imageRef?: string;
}

export interface DeploymentCard {
  id: string;
  seedId: SeedId;
  name: ProperName;
  scale: ScaleId;
  battlefield: { width: number; height: number };
  /** Obligatorio: el diagrama de marcadores ES la carta (hallazgo M4). */
  imageRef: string;
  notes?: Localized;
}

export interface Catalog {
  schemaVersion: string;
  contentVersion: string;
  sourceRef: string;
  scales: EngagementScale[];
  factionCards: FactionCard[];
  tacticalCards: TacticalCard[];
  creepCards: CreepCard[];
  unitCards: UnitCard[];
  unitEntries: UnitEntry[];
  missionCards: MissionCard[];
  deploymentCards: DeploymentCard[];
}

// ---------------------------------------------------------------------------
// Lista del usuario
// ---------------------------------------------------------------------------

export interface AppliedUpgrade {
  upgradeId: string;
  /** `null` en mejoras estándar; índice del modelo nominado en SPECIALIST. */
  modelIndex: number | null;
}

export interface ListEntry {
  instanceId: string;
  unitEntryId: string;
  compositionId: string;
  upgrades: AppliedUpgrade[];
  customLabel?: string;
  /** Unidad invocada añadida solo para tener sus stats a mano. No computa. */
  reference: boolean;
}

export interface ArmyList {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  catalogContentVersion: string;
  schemaVersion: string;

  race: Race;
  scaleId: ScaleId;
  mineralLimit: number;
  factionCardId: string | null;
  tacticalCardIds: string[];
  creepCardId: string | null;
  entries: ListEntry[];

  missionCardIds: string[];
  deploymentCardIds: string[];

  notes?: string;
}

// ---------------------------------------------------------------------------
// Resultado de validación
// ---------------------------------------------------------------------------

export interface SlotLedgerSource {
  cardId: string;
  cardName: ProperName;
  amount: number;
}

export interface SlotLedgerConsumer {
  instanceId: string;
  unitName: ProperName;
  amount: number;
}

export interface SlotLedger {
  used: number;
  total: number;
  grantedBy: SlotLedgerSource[];
  consumedBy: SlotLedgerConsumer[];
}

export interface CostSummary {
  mineralsSpent: number;
  mineralLimit: number;
  vespeneSpent: number;
  vespeneLimit: number;
  resourceType: ResourceType | null;
  resourcePerRound: number;
  totalSupply: number;
  slots: Record<SlotType, SlotLedger>;
}

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  rule: string;
  ruleRef: string;
  severity: IssueSeverity;
  message: Localized;
  entryInstanceId?: string;
  remedy?: Localized;
}

export interface ValidationResult {
  legal: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: CostSummary;
}

// ---------------------------------------------------------------------------
// Elegibilidad (SDD §6.6, filtrado en dos niveles)
// ---------------------------------------------------------------------------

/**
 * - `available`  : se puede añadir.
 * - `blocked`    : legal en este ejército pero ahora no cabe. SE MUESTRA.
 * - `impossible` : nunca podrá formar parte de este ejército. SE OCULTA.
 *
 * El motor solo clasifica; mostrar u ocultar es decisión de la interfaz.
 */
export type EligibilityStatus = 'available' | 'blocked' | 'impossible';

export interface Eligibility {
  status: EligibilityStatus;
  reason?: Localized;
  remedy?: Localized;
}

export interface EligibleUnit extends Eligibility {
  entry: UnitEntry;
  /** Elegibilidad por composición: con 2 modelos puede caber y con 4 no. */
  compositions: Array<{ composition: Composition } & Eligibility>;
}

export interface EligibleTacticalCard extends Eligibility {
  card: TacticalCard;
}

export interface EligibleCreepCard extends Eligibility {
  card: CreepCard;
}
