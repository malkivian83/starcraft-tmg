import { describe, expect, it } from 'vitest';
import { loadCatalog } from '@/catalog/loader';

describe('Perfil de Swarmling', () => {
  const catalog = loadCatalog('ZERG').catalog;
  const swarmling = catalog.unitCards.find(
    (card) => card.id === 'zerg.card.swarmling',
  );

  it('incluye el arma y las habilidades de su ficha oficial', () => {
    expect(swarmling).toMatchObject({
      profile: { evade: '5+' },
      weapons: [
        {
          name: 'Claws',
          range: 'E',
          target: 'Ground',
          rateOfAttack: '2',
          hit: '5+',
          damage: '1',
        },
      ],
    });
    expect(swarmling?.abilities.map((ability) => ability.name)).toEqual([
      'Squadron',
      'Zergling Reconstitution',
      'Metabolic Boost',
      'Devastating Charge',
    ]);
  });
});
