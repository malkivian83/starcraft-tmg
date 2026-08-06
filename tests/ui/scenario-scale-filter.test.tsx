import { describe, expect, it } from 'vitest';
import { loadCatalog } from '@/catalog/loader';
import { createEmptyList, useListStore } from '@/store/listStore';
import { playableScenarioCards } from '@/ui/builder/StepScenario';

describe('filtro de escenarios por escala', () => {
  const catalog = loadCatalog('ZERG').catalog;

  it('muestra únicamente misiones y despliegues de escala estándar', () => {
    const { missions, deployments } = playableScenarioCards(
      catalog,
      'standard',
    );

    expect(missions).toHaveLength(5);
    expect(deployments).toHaveLength(5);
    expect(missions.every((mission) => mission.scale === 'standard')).toBe(true);
    expect(deployments.every((deployment) => deployment.scale === 'standard')).toBe(true);
    expect(deployments.map((deployment) => deployment.name)).toContain('Gauntlet');
    expect(deployments.map((deployment) => deployment.name)).not.toContain('Abandoned Camp');
  });

  it('muestra únicamente misiones y despliegues de escala escaramuza', () => {
    const { missions, deployments } = playableScenarioCards(
      catalog,
      'skirmish',
    );

    expect(missions).toHaveLength(5);
    expect(deployments).toHaveLength(5);
    expect(missions.every((mission) => mission.scale === 'skirmish')).toBe(true);
    expect(deployments.every((deployment) => deployment.scale === 'skirmish')).toBe(true);
    expect(deployments.map((deployment) => deployment.name)).toContain('Abandoned Camp');
    expect(deployments.map((deployment) => deployment.name)).not.toContain('Gauntlet');
  });

  it('descarta las selecciones incompatibles al cambiar de escala', () => {
    const list = createEmptyList('ZERG');
    list.scaleId = 'standard';
    list.missionCardIds = [
      'mission.hold_position.standard',
      'mission.frontlines.skirmish',
    ];
    list.deploymentCardIds = [
      'deployment.gauntlet',
      'deployment.frontier',
    ];
    useListStore.getState().setList(list);

    useListStore.getState().setScale('skirmish');

    const changed = useListStore.getState().list;
    expect(changed.missionCardIds).toEqual(['mission.frontlines.skirmish']);
    expect(changed.deploymentCardIds).toEqual(['deployment.frontier']);
  });
});
