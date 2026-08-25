import { describe, expect, beforeEach, it } from 'vitest';
import { getEligibleUnits } from '@/engine/eligibility';
import { useListStore } from '@/store/listStore';

describe('reclutamiento antes de las Cartas Tácticas', () => {
  beforeEach(() => {
    useListStore.getState().resetForRace('ZERG');
  });

  it('exige Carta de Facción antes de añadir una unidad', () => {
    const result = useListStore.getState().addUnit('zerg.entry.hydralisk', '4');

    expect(result).toEqual({ ok: false, constraint: 'MISSING_FACTION' });
    expect(useListStore.getState().list.entries).toHaveLength(0);
  });

  it('permite una unidad provisional y conserva R4 hasta comprar espacios', () => {
    useListStore.getState().selectFactionCard('zerg.faction.zerg_swarm');

    const result = useListStore.getState().addUnit('zerg.entry.hydralisk', '4');
    expect(result.ok).toBe(true);
    expect(useListStore.getState().list.entries).toHaveLength(1);
    expect(useListStore.getState().validation.errors.map((issue) => issue.rule)).toContain('R4');

    useListStore.getState().addTacticalCard('zerg.tactical.hydralisk_den');
    expect(useListStore.getState().validation.errors.map((issue) => issue.rule)).not.toContain('R4');
  });

  it('calcula el déficit de espacios acumulado después de otra alta provisional', () => {
    useListStore.getState().selectFactionCard('zerg.faction.zerg_swarm');
    expect(useListStore.getState().addUnit('zerg.entry.hydralisk', '4').ok).toBe(true);

    const { list, index } = useListStore.getState();
    const hydralisk = getEligibleUnits(list, index).find((unit) => unit.entry.id === 'zerg.entry.hydralisk');
    const second = hydralisk?.compositions.find((composition) => composition.composition.id === '2');

    expect(second?.status).toBe('provisional');
    expect(second?.projectedSlotDeficit).toBe(4);
  });

  it('mantiene visibles las incompatibles y deshabilita una UNIQUE ya incluida', () => {
    useListStore.getState().selectFactionCard('zerg.faction.zerg_swarm');
    const add = useListStore.getState().addUnit('zerg.entry.kerrigan', '1');
    expect(add.ok).toBe(true);

    const { list, index } = useListStore.getState();
    const units = getEligibleUnits(list, index);
    const kerrigan = units.find((unit) => unit.entry.id === 'zerg.entry.kerrigan');
    const raptor = units.find((unit) => unit.entry.id === 'zerg.entry.kerrigan_swarm_raptor');

    expect(kerrigan?.status).toBe('impossible');
    expect(kerrigan?.constraint).toBe('UNIQUE_ALREADY_INCLUDED');
    expect(raptor?.status).toBe('impossible');
    expect(raptor?.constraint).toBe('TAG_MISMATCH');
  });

  it('permite referencias invocadas, pero no recluta una invocada', () => {
    useListStore.getState().selectFactionCard('zerg.faction.zerg_swarm');

    const wrongAction = useListStore.getState().addUnit('zerg.entry.roachling', '3');
    expect(wrongAction).toEqual({ ok: false, constraint: 'WRONG_RECRUITMENT_ACTION' });

    const reference = useListStore.getState().addReferenceUnit('zerg.entry.roachling');
    expect(reference.ok).toBe(true);
    expect(useListStore.getState().list.entries[0]?.reference).toBe(true);
    expect(useListStore.getState().summary.mineralsSpent).toBe(0);
  });
});
