import { describe, expect, it } from 'vitest';
import { getEligibleUnits } from '@/engine/eligibility';
import type { Race } from '@/engine/types';
import { validateList } from '@/engine/validate';
import { emptyList, entry, indexFor } from '../fixtures';

const HERO_CASES = [
  {
    race: 'ZERG',
    heroId: 'zerg.entry.kerrigan',
    factionId: 'zerg.faction.zerg_swarm',
    heroFactionId: 'zerg.faction.kerrigans_swarm',
    slotCardId: 'zerg.tactical.overlord',
    tags: ['ZERG'],
  },
  {
    race: 'TERRAN',
    heroId: 'terran.entry.jim_raynor',
    factionId: 'terran.faction.terran_armed_forces',
    heroFactionId: 'terran.faction.raynors_raiders',
    slotCardId: 'terran.tactical.supply_depot',
    tags: ['TERRAN'],
  },
  {
    race: 'PROTOSS',
    heroId: 'protoss.entry.artanis',
    factionId: 'protoss.faction.daelaam',
    heroFactionId: 'protoss.faction.khalai',
    slotCardId: 'protoss.tactical.power_field',
    tags: ['PROTOSS'],
  },
] as const satisfies readonly {
  race: Race;
  heroId: string;
  factionId: string;
  heroFactionId: string;
  slotCardId: string;
  tags: readonly string[];
}[];

describe('Elegibilidad de héroes según sus cartas oficiales', () => {
  it.each(HERO_CASES)('$heroId conserva solo las etiquetas impresas', ({ race, heroId, tags }) => {
    const hero = indexFor(race).unitEntries.get(heroId);

    expect(hero?.slotType).toBe('HERO');
    expect(hero?.unique).toBe(true);
    expect(hero?.summoned).toBe(false);
    expect(hero?.tags).toEqual(tags);
  });

  it.each(HERO_CASES)(
    '$heroId requiere un hueco HERO, no una subfacción',
    ({ race, heroId, factionId, heroFactionId, slotCardId }) => {
      const index = indexFor(race);
      const findHero = (selectedFactionId: string, tacticalCardIds: string[]) =>
        getEligibleUnits(
          emptyList({ race, factionCardId: selectedFactionId, tacticalCardIds }),
          index,
        ).find((unit) => unit.entry.id === heroId);

      expect(index.factionCards.get(factionId)?.startingSlots.HERO).toBeUndefined();
      expect(index.tacticalCards.get(slotCardId)?.slotsGranted.HERO).toBe(1);
      expect(index.factionCards.get(heroFactionId)?.startingSlots.HERO).toBe(1);

      const withoutHeroSlot = findHero(factionId, []);
      expect(withoutHeroSlot?.status).toBe('provisional');
      expect(withoutHeroSlot?.reason?.es).toContain('Héroe');
      expect(withoutHeroSlot?.compositions[0]?.status).toBe('provisional');

      expect(findHero(factionId, [slotCardId])?.status).toBe('available');
      expect(findHero(heroFactionId, [])?.status).toBe('available');

      const validationRules = validateList(
        emptyList({
          race,
          factionCardId: factionId,
          tacticalCardIds: [slotCardId],
          entries: [entry(heroId, '1')],
        }),
        index,
      ).errors.map((issue) => issue.rule);

      expect(validationRules).not.toContain('R3');
      expect(validationRules).not.toContain('R4');
    },
  );
});
