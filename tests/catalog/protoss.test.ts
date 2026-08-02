import { describe, expect, it } from 'vitest';
import { buildCatalogIndex } from '@/engine/catalogIndex';
import { loadCatalog } from '@/catalog/loader';
import { getEligibleUnits } from '@/engine/eligibility';
import { emptyList } from '../fixtures';

const index = buildCatalogIndex(loadCatalog('PROTOSS').catalog);

function protossList(factionCardId: string) {
  return emptyList({
    race: 'PROTOSS',
    factionCardId,
    missionCardIds: [
      'mission.frontlines.standard',
      'mission.supply_drop.standard',
    ],
    deploymentCardIds: ['deployment.gauntlet', 'deployment.typhoon'],
  });
}

describe('Catálogo Protoss', () => {
  it('tiene las 7 unidades del reglamento', () => {
    expect(index.catalog.unitEntries.map((e) => e.name).sort()).toEqual([
      'Adept',
      'Artanis',
      'Praetor Guard (Zealot)',
      'Pylon',
      'Sentry',
      'Stalker',
      'Zealot',
    ]);
  });

  it('reproduce los costes del apéndice §12.10', () => {
    const cost = (id: string, comp: string) =>
      index.unitEntries
        .get(id)!
        .compositions.find((c) => c.id === comp)!;

    expect(cost('protoss.entry.zealot', '3')).toMatchObject({
      mineralCost: 160,
      supplyValue: 2,
    });
    expect(cost('protoss.entry.praetor_guard', '3')).toMatchObject({
      mineralCost: 280,
      supplyValue: 2,
    });
    expect(cost('protoss.entry.adept', '4')).toMatchObject({
      mineralCost: 150,
      supplyValue: 1,
    });
    expect(cost('protoss.entry.sentry', '2')).toMatchObject({
      mineralCost: 130,
      supplyValue: 1,
    });
    expect(cost('protoss.entry.stalker', '1')).toMatchObject({
      mineralCost: 170,
      supplyValue: 1,
    });
    expect(cost('protoss.entry.stalker', '2')).toMatchObject({
      mineralCost: 270,
      supplyValue: 2,
    });
    expect(cost('protoss.entry.artanis', '1')).toMatchObject({
      mineralCost: 250,
      supplyValue: 1,
    });
  });

  it('el coste de las mejoras del Stalker depende de la composición', () => {
    const stalker = index.unitEntries.get('protoss.entry.stalker')!;
    const path = stalker.upgrades.find((u) => u.id === 'path_of_shadows')!;
    expect(path.costByComposition).toEqual({ '1': 20, '2': 40 });
  });

  it('suma correctamente el gas de las cartas tácticas', () => {
    const gas = Object.fromEntries(
      index.catalog.tacticalCards.map((c) => [c.name, c.vespeneCost]),
    );
    // §12.11
    expect(gas).toMatchObject({
      Gateway: 25,
      'Warp Gate': 40,
      'Gate Chronoboosted': 35,
      Observer: 25,
      Nexus: 35,
      'Overcharged Nexus': 35,
      'Power Field': 40,
      Forge: 30,
      'Warp Prism': 35,
      'Twilight Council': 45,
    });
  });

  /**
   * R3 con la sub-facción Khalai. Es la regla donde un error no revienta:
   * simplemente da por legal una lista que no lo es.
   */
  describe('R3 — etiqueta KHALAI', () => {
    it('el Praetor Guard solo es elegible con Khalai', () => {
      const bajoKhalai = getEligibleUnits(
        protossList('protoss.faction.khalai'),
        index,
      ).find((u) => u.entry.id === 'protoss.entry.praetor_guard');
      expect(bajoKhalai?.status).toBe('available');

      const bajoDaelaam = getEligibleUnits(
        protossList('protoss.faction.daelaam'),
        index,
      ).find((u) => u.entry.id === 'protoss.entry.praetor_guard');
      expect(bajoDaelaam?.status).toBe('impossible');
    });

    it('el resto de unidades es elegible con ambas facciones', () => {
      for (const faction of ['protoss.faction.khalai', 'protoss.faction.daelaam']) {
        const bloqueadasPorEtiqueta = getEligibleUnits(
          protossList(faction),
          index,
        )
          .filter((u) => u.status === 'impossible')
          .map((u) => u.entry.id);

        expect(bloqueadasPorEtiqueta).toEqual(
          faction === 'protoss.faction.daelaam'
            ? ['protoss.entry.praetor_guard']
            : [],
        );
      }
    });

    it('Daelaam no otorga espacio de Héroe, pero Khalai sí', () => {
      // Con Daelaam, Artanis solo cabe comprando Power Field (1 × HERO).
      expect(
        index.factionCards.get('protoss.faction.daelaam')!.startingSlots.HERO,
      ).toBeUndefined();
      expect(
        index.factionCards.get('protoss.faction.khalai')!.startingSlots.HERO,
      ).toBe(1);
      expect(
        index.tacticalCards.get('protoss.tactical.power_field')!.slotsGranted
          .HERO,
      ).toBe(1);
    });
  });

  it('el Pylon es una unidad invocada y no computa', () => {
    const pylon = index.unitEntries.get('protoss.entry.pylon')!;
    expect(pylon.summoned).toBe(true);
    expect(pylon.compositions[0]!.mineralCost).toBe(0);
    expect(pylon.compositions[0]!.supplyValue).toBe(0);
  });
});
