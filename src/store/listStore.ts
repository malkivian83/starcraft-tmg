import { create } from 'zustand';
import { loadCatalog } from '@/catalog/loader';
import { buildCatalogIndex, type CatalogIndex } from '@/engine/catalogIndex';
import { computeCosts, findComposition } from '@/engine/costing';
import type {
  AppliedUpgrade,
  ArmyList,
  CostSummary,
  Race,
  ScaleId,
  ValidationResult,
} from '@/engine/types';
import { validateList } from '@/engine/validate';

const SCHEMA_VERSION = '1.0.0';

function newId(): string {
  return crypto.randomUUID();
}

export function createEmptyList(race: Race = 'ZERG'): ArmyList {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: 'Nueva lista',
    createdAt: now,
    updatedAt: now,
    catalogContentVersion: '2026.05.1.0',
    schemaVersion: SCHEMA_VERSION,
    race,
    scaleId: 'standard',
    mineralLimit: 2000,
    factionCardId: null,
    tacticalCardIds: [],
    creepCardId: null,
    entries: [],
    missionCardIds: [],
    deploymentCardIds: [],
  };
}

interface ListState {
  list: ArmyList;
  index: CatalogIndex;
  summary: CostSummary;
  validation: ValidationResult;
  remoteRevision: number | null;
  isDirty: boolean;

  setList: (list: ArmyList) => void;
  setRemoteRevision: (revision: number | null) => void;
  markSaved: () => void;
  resetForRace: (race: Race) => void;
  patch: (changes: Partial<ArmyList>) => void;

  setRace: (race: Race) => void;
  setScale: (scaleId: ScaleId) => void;
  setMineralLimit: (limit: number) => void;
  setName: (name: string) => void;

  selectFactionCard: (id: string) => void;
  addTacticalCard: (id: string) => void;
  removeTacticalCard: (id: string) => void;
  selectCreepCard: (id: string) => void;

  addUnit: (unitEntryId: string, compositionId: string) => void;
  addReferenceUnit: (unitEntryId: string) => void;
  removeUnit: (instanceId: string) => void;
  moveUnit: (instanceId: string, direction: 'up' | 'down') => void;
  changeComposition: (instanceId: string, compositionId: string) => void;
  toggleUpgrade: (instanceId: string, upgradeId: string) => void;
  setUpgradeModel: (
    instanceId: string,
    upgradeId: string,
    modelIndex: number,
  ) => void;

  toggleMission: (id: string) => void;
  toggleDeployment: (id: string) => void;
}

function indexFor(race: Race): CatalogIndex {
  return buildCatalogIndex(loadCatalog(race).catalog);
}

function derive(list: ArmyList, index: CatalogIndex) {
  return {
    list,
    index,
    summary: computeCosts(list, index),
    validation: validateList(list, index),
  };
}

/**
 * Estado de la lista en edición.
 *
 * Todo lo derivado —costes, espacios, validez— se recalcula en cada cambio y
 * NUNCA se guarda dentro de la lista. Persistir totales permitiría que un
 * fichero editado a mano mintiera sobre su propia legalidad.
 */
export const useListStore = create<ListState>((set, get) => {
  const initialIndex = indexFor('ZERG');
  const initialList = createEmptyList('ZERG');

  const apply = (changes: Partial<ArmyList>, index?: CatalogIndex) => {
    const state = get();
    const next: ArmyList = {
      ...state.list,
      ...changes,
      updatedAt: new Date().toISOString(),
    };
    set({ ...derive(next, index ?? state.index), isDirty: true });
  };

  return {
    ...derive(initialList, initialIndex),
    remoteRevision: null,
    isDirty: false,

    setList: (list) => set({ ...derive(list, indexFor(list.race)), remoteRevision: null, isDirty: true }),
    setRemoteRevision: (remoteRevision) => set({ remoteRevision }),
    markSaved: () => set({ isDirty: false }),
    resetForRace: (race) => set({ ...derive(createEmptyList(race), indexFor(race)), remoteRevision: null, isDirty: false }),
    patch: (changes) => apply(changes),

    setRace: (race) => {
      // Cambiar de raza invalida todas las referencias al catálogo anterior,
      // así que se empieza una lista nueva conservando escala y presupuesto.
      const { list } = get();
      const fresh = createEmptyList(race);
      fresh.name = list.name;
      fresh.scaleId = list.scaleId;
      fresh.mineralLimit = list.mineralLimit;
      set({ ...derive(fresh, indexFor(race)), remoteRevision: null, isDirty: true });
    },

    setScale: (scaleId) => {
      const { index, list } = get();
      const scale = index.catalog.scales.find((s) => s.id === scaleId);
      const limit = scale?.mineralLimit ?? list.mineralLimit;
      apply({
        scaleId,
        mineralLimit: limit,
        missionCardIds: list.missionCardIds.filter(
          (id) => index.missionCards.get(id)?.scale === scaleId,
        ),
        deploymentCardIds: list.deploymentCardIds.filter(
          (id) => index.deploymentCards.get(id)?.scale === scaleId,
        ),
      });
    },

    setMineralLimit: (mineralLimit) =>
      apply({ mineralLimit: Math.max(1, Math.round(mineralLimit)) }),

    setName: (name) => apply({ name }),

    selectFactionCard: (id) => {
      const { list, index } = get();
      if (list.factionCardId === id) return;
      const faction = index.factionCards.get(id);
      // Al cambiar de facción se limpia lo que dependía de la anterior:
      // dejarlo produciría una lista con errores que el usuario no ha causado.
      apply({
        factionCardId: id,
        tacticalCardIds: [],
        creepCardId: faction?.race === 'ZERG' ? list.creepCardId : null,
        entries: [],
      });
    },

    // Añadir y quitar son acciones DISTINTAS, no un interruptor: las cartas
    // que no son UNIQUE pueden llevarse varias veces (§9.1.5), y con un
    // toggle la segunda pulsación de «Añadir» quitaba la primera copia.
    addTacticalCard: (id) => {
      const { list, index } = get();
      if (!index.tacticalCards.get(id)) return;
      apply({ tacticalCardIds: [...list.tacticalCardIds, id] });
    },

    /** Quita una sola copia, no todas: puede haber varias de la misma carta. */
    removeTacticalCard: (id) => {
      const { list } = get();
      const next = [...list.tacticalCardIds];
      const position = next.indexOf(id);
      if (position === -1) return;
      next.splice(position, 1);
      apply({ tacticalCardIds: next });
    },

    selectCreepCard: (id) =>
      apply({ creepCardId: get().list.creepCardId === id ? null : id }),

    addUnit: (unitEntryId, compositionId) => {
      const { list } = get();
      apply({
        entries: [
          ...list.entries,
          {
            instanceId: newId(),
            unitEntryId,
            compositionId,
            upgrades: [],
            reference: false,
          },
        ],
      });
    },

    addReferenceUnit: (unitEntryId) => {
      const { list, index } = get();
      const entry = index.unitEntries.get(unitEntryId);
      const composition = entry?.compositions[0];
      if (!entry || !composition) return;
      apply({
        entries: [
          ...list.entries,
          {
            instanceId: newId(),
            unitEntryId,
            compositionId: composition.id,
            upgrades: [],
            reference: true,
          },
        ],
      });
    },

    removeUnit: (instanceId) =>
      apply({
        entries: get().list.entries.filter((e) => e.instanceId !== instanceId),
      }),

    moveUnit: (instanceId, direction) => {
      const { list } = get();
      const from = list.entries.findIndex((entry) => entry.instanceId === instanceId);
      if (from === -1) return;

      const to = from + (direction === 'up' ? -1 : 1);
      if (to < 0 || to >= list.entries.length) return;

      const entries = [...list.entries];
      const current = entries[from];
      const target = entries[to];
      if (!current || !target) return;
      entries[from] = target;
      entries[to] = current;
      apply({ entries });
    },

    changeComposition: (instanceId, compositionId) => {
      const { list, index } = get();
      apply({
        entries: list.entries.map((e) => {
          if (e.instanceId !== instanceId) return e;
          const unit = index.unitEntries.get(e.unitEntryId);
          const composition = unit
            ? findComposition(unit, compositionId)
            : undefined;

          // Al cambiar de composición hay que revisar las mejoras: algunas no
          // están disponibles para el nuevo tamaño, y una SPECIALIST puede
          // apuntar a un modelo que ya no existe.
          const upgrades = e.upgrades.filter((applied) => {
            const upgrade = unit?.upgrades.find(
              (u) => u.id === applied.upgradeId,
            );
            if (!upgrade) return false;
            if (upgrade.costByComposition[compositionId] === undefined) {
              return false;
            }
            if (
              applied.modelIndex !== null &&
              composition &&
              applied.modelIndex >= composition.models
            ) {
              return false;
            }
            return true;
          });

          return { ...e, compositionId, upgrades };
        }),
      });
    },

    toggleUpgrade: (instanceId, upgradeId) => {
      const { list, index } = get();
      apply({
        entries: list.entries.map((e) => {
          if (e.instanceId !== instanceId) return e;
          const unit = index.unitEntries.get(e.unitEntryId);
          const upgrade = unit?.upgrades.find((u) => u.id === upgradeId);
          if (!upgrade) return e;

          const existing = e.upgrades.find((u) => u.upgradeId === upgradeId);
          if (existing) {
            return {
              ...e,
              upgrades: e.upgrades.filter((u) => u.upgradeId !== upgradeId),
            };
          }

          // Una mejora SPECIALIST necesita modelo nominado: se propone el
          // primer modelo libre para que la lista no nazca ya inválida.
          let modelIndex: number | null = null;
          if (upgrade.specialist) {
            const taken = new Set(
              e.upgrades
                .map((u) => u.modelIndex)
                .filter((i): i is number => i !== null),
            );
            const composition = unit
              ? findComposition(unit, e.compositionId)
              : undefined;
            const models = composition?.models ?? 1;
            modelIndex = 0;
            while (modelIndex < models && taken.has(modelIndex)) modelIndex++;
            if (modelIndex >= models) modelIndex = 0;
          }

          const applied: AppliedUpgrade = { upgradeId, modelIndex };
          return { ...e, upgrades: [...e.upgrades, applied] };
        }),
      });
    },

    setUpgradeModel: (instanceId, upgradeId, modelIndex) =>
      apply({
        entries: get().list.entries.map((e) =>
          e.instanceId === instanceId
            ? {
                ...e,
                upgrades: e.upgrades.map((u) =>
                  u.upgradeId === upgradeId ? { ...u, modelIndex } : u,
                ),
              }
            : e,
        ),
      }),

    toggleMission: (id) => {
      const { list } = get();
      const has = list.missionCardIds.includes(id);
      apply({
        missionCardIds: has
          ? list.missionCardIds.filter((m) => m !== id)
          : [...list.missionCardIds, id],
      });
    },

    toggleDeployment: (id) => {
      const { list } = get();
      const has = list.deploymentCardIds.includes(id);
      apply({
        deploymentCardIds: has
          ? list.deploymentCardIds.filter((d) => d !== id)
          : [...list.deploymentCardIds, id],
      });
    },
  };
});
