import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyList, useListStore } from '@/store/listStore';

/**
 * Regresión de tres fallos encontrados usando la aplicación:
 *
 *  1. Una carta UNIQUE, una vez añadida, no se podía quitar.
 *  2. No se podían llevar dos copias de una carta que no es UNIQUE.
 *  3. Quitar una carta repetida las eliminaba todas.
 */
describe('Cartas tácticas: añadir y quitar', () => {
  beforeEach(() => {
    const fresh = createEmptyList('ZERG');
    fresh.factionCardId = 'zerg.faction.zerg_swarm';
    useListStore.getState().setList(fresh);
  });

  const ids = () => useListStore.getState().list.tacticalCardIds;

  it('permite varias copias de una carta que no es UNIQUE', () => {
    const { addTacticalCard } = useListStore.getState();
    // Spawning Pool no es UNIQUE: el reglamento permite llevar varias.
    addTacticalCard('zerg.tactical.spawning_pool');
    addTacticalCard('zerg.tactical.spawning_pool');
    addTacticalCard('zerg.tactical.spawning_pool');

    expect(ids()).toEqual([
      'zerg.tactical.spawning_pool',
      'zerg.tactical.spawning_pool',
      'zerg.tactical.spawning_pool',
    ]);
  });

  it('cada copia suma espacios y gas', () => {
    const { addTacticalCard } = useListStore.getState();
    addTacticalCard('zerg.tactical.spawning_pool');
    addTacticalCard('zerg.tactical.spawning_pool');

    const { summary } = useListStore.getState();
    // Zerg Swarm aporta 3 de Núcleo; dos Spawning Pool añaden 1 cada una.
    expect(summary.slots.CORE.total).toBe(5);
    expect(summary.vespeneSpent).toBe(50);
  });

  it('quitar elimina UNA copia, no todas', () => {
    const { addTacticalCard, removeTacticalCard } = useListStore.getState();
    addTacticalCard('zerg.tactical.spawning_pool');
    addTacticalCard('zerg.tactical.spawning_pool');
    removeTacticalCard('zerg.tactical.spawning_pool');

    expect(ids()).toEqual(['zerg.tactical.spawning_pool']);
  });

  it('una carta UNIQUE se puede quitar después de añadirla', () => {
    const { addTacticalCard, removeTacticalCard } = useListStore.getState();
    addTacticalCard('zerg.tactical.lair');
    expect(ids()).toEqual(['zerg.tactical.lair']);

    removeTacticalCard('zerg.tactical.lair');
    expect(ids()).toEqual([]);
  });

  it('quitar una carta que no está en la lista no hace nada', () => {
    useListStore.getState().removeTacticalCard('zerg.tactical.lair');
    expect(ids()).toEqual([]);
  });

  it('llevar dos copias de una UNIQUE es ilegal (R7)', () => {
    const { addTacticalCard } = useListStore.getState();
    addTacticalCard('zerg.tactical.lair');
    addTacticalCard('zerg.tactical.lair');

    const rules = useListStore
      .getState()
      .validation.errors.map((e) => e.rule);
    expect(rules).toContain('R7');
  });
});

describe('Elegibilidad de cartas tácticas', () => {
  beforeEach(() => {
    const fresh = createEmptyList('ZERG');
    fresh.factionCardId = 'zerg.faction.zerg_swarm';
    useListStore.getState().setList(fresh);
  });

  it('una UNIQUE ya incluida deja de poder añadirse', async () => {
    const { getEligibleTacticalCards } = await import('@/engine/eligibility');
    const { addTacticalCard } = useListStore.getState();
    addTacticalCard('zerg.tactical.lair');

    const { list, index, summary } = useListStore.getState();
    const lair = getEligibleTacticalCards(list, index, summary).find(
      (c) => c.card.id === 'zerg.tactical.lair',
    );

    // Sigue siendo "no añadible", pero la interfaz debe mostrarla igualmente
    // porque está en la lista y hay que poder retirarla.
    expect(lair?.status).toBe('impossible');
    expect(list.tacticalCardIds).toContain('zerg.tactical.lair');
  });

  it('una carta no UNIQUE sigue disponible tras añadirla', async () => {
    const { getEligibleTacticalCards } = await import('@/engine/eligibility');
    const { addTacticalCard } = useListStore.getState();
    addTacticalCard('zerg.tactical.spawning_pool');

    const { list, index, summary } = useListStore.getState();
    const pool = getEligibleTacticalCards(list, index, summary).find(
      (c) => c.card.id === 'zerg.tactical.spawning_pool',
    );
    expect(pool?.status).toBe('available');
  });
});
