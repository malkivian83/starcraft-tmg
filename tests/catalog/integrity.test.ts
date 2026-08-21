import { describe, expect, it } from 'vitest';
import { availableRaces, loadCatalog } from '@/catalog/loader';
import type { Catalog, Race } from '@/engine/types';

/**
 * Verificación de integridad del catálogo (modelo de datos §8).
 *
 * Estas pruebas no comprueban que los datos sean CORRECTOS —para eso está el
 * caso de regresión del manual y la revisión humana—, sino que sean COHERENTES:
 * sin referencias rotas, sin seedId repetidos, sin campos vacíos.
 */

const races = availableRaces();
const catalogs = new Map<Race, Catalog>(
  races.map((r) => [r, loadCatalog(r).catalog]),
);

describe.each(races)('Catálogo %s', (race) => {
  const catalog = catalogs.get(race)!;

  it('valida contra el esquema y carga sin problemas', () => {
    expect(loadCatalog(race).problems).toEqual([]);
  });

  it('usa Alcance de Enfrentamiento en las traducciones', () => {
    expect(JSON.stringify(catalog)).not.toContain('Alcance de Trabazón');
  });

  it('toda UnitEntry apunta a una UnitCard existente', () => {
    const cardIds = new Set(catalog.unitCards.map((c) => c.id));
    const orphans = catalog.unitEntries
      .filter((e) => !cardIds.has(e.cardId))
      .map((e) => `${e.id} → ${e.cardId}`);
    expect(orphans).toEqual([]);
  });

  it('toda UnitCard tiene al menos una UnitEntry', () => {
    // Una carta sin entrada es una unidad que nunca podría reclutarse:
    // señal de que falta cruzar el apéndice de puntos con las hojas de cartas.
    const usedCards = new Set(catalog.unitEntries.map((e) => e.cardId));
    const unused = catalog.unitCards
      .filter((c) => !usedCards.has(c.id))
      .map((c) => c.id);
    expect(unused).toEqual([]);
  });

  it('toda unidad no invocada tiene coste y composiciones', () => {
    const broken = catalog.unitEntries
      .filter((e) => !e.summoned)
      .filter(
        (e) =>
          e.compositions.length === 0 ||
          e.compositions.some((c) => c.mineralCost <= 0),
      )
      .map((e) => e.id);
    expect(broken).toEqual([]);
  });

  it('los ids de composición son únicos dentro de cada unidad', () => {
    const dupes: string[] = [];
    for (const e of catalog.unitEntries) {
      const ids = e.compositions.map((c) => c.id);
      if (new Set(ids).size !== ids.length) dupes.push(e.id);
    }
    expect(dupes).toEqual([]);
  });

  it('los ids de mejora son únicos dentro de cada unidad', () => {
    const dupes: string[] = [];
    for (const e of catalog.unitEntries) {
      const ids = e.upgrades.map((u) => u.id);
      if (new Set(ids).size !== ids.length) dupes.push(e.id);
    }
    expect(dupes).toEqual([]);
  });

  it('toda mejora tiene coste para al menos una composición existente', () => {
    const broken: string[] = [];
    for (const e of catalog.unitEntries) {
      const compIds = new Set(e.compositions.map((c) => c.id));
      for (const u of e.upgrades) {
        const keys = Object.keys(u.costByComposition);
        if (keys.length === 0) broken.push(`${e.id}/${u.id}: sin costes`);
        for (const k of keys) {
          if (!compIds.has(k)) {
            broken.push(`${e.id}/${u.id}: composición "${k}" no existe`);
          }
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it('los seedId son únicos en todo el catálogo de la raza', () => {
    // Un seedId repetido haría que un seed compartido decodificara la unidad
    // equivocada, sin dar ningún error. Es el fallo más grave posible aquí.
    const seen = new Map<number, string>();
    const clashes: string[] = [];
    const record = (seedId: number, what: string) => {
      const prev = seen.get(seedId);
      if (prev) clashes.push(`${seedId}: ${prev} vs ${what}`);
      else seen.set(seedId, what);
    };

    for (const c of catalog.factionCards) record(c.seedId, c.id);
    for (const c of catalog.tacticalCards) record(c.seedId, c.id);
    for (const c of catalog.creepCards) record(c.seedId, c.id);
    for (const e of catalog.unitEntries) {
      record(e.seedId, e.id);
      for (const u of e.upgrades) record(u.seedId, `${e.id}/${u.id}`);
    }
    expect(clashes).toEqual([]);
  });

  it('toda mejora tiene texto que explica qué hace', () => {
    // Sin esto, la ficha impresa muestra el nombre de la mejora sin decir qué
    // hace, que es justo lo que se olvida en mitad de una partida.
    const sinTexto: string[] = [];
    for (const entry of catalog.unitEntries) {
      for (const upgrade of entry.upgrades) {
        const described =
          Boolean(upgrade.text?.es) ||
          upgrade.grantsAbilities.some((a) => a.text.es.trim().length > 0);
        if (!described) sinTexto.push(`${entry.name} → ${upgrade.name}`);
      }
    }
    expect(sinTexto).toEqual([]);
  });

  it('cada habilidad y mejora conserva la fase en la que puede usarse', () => {
    const withoutPhase: string[] = [];
    const inspect = (owner: string, abilities: Array<{ phase: string }>) => {
      abilities.forEach((ability, index) => {
        if (!ability.phase) withoutPhase.push(`${owner}#${index}`);
      });
    };
    catalog.factionCards.forEach((card) => inspect(card.name, card.abilities));
    catalog.tacticalCards.forEach((card) => inspect(card.name, card.abilities));
    catalog.creepCards.forEach((card) => inspect(card.name, card.abilities));
    catalog.unitCards.forEach((card) => inspect(card.name, card.abilities));
    catalog.unitEntries.forEach((entry) =>
      entry.upgrades.forEach((upgrade) => inspect(`${entry.name} → ${upgrade.name}`, upgrade.grantsAbilities)),
    );
    expect(withoutPhase).toEqual([]);
  });

  it('toda mejora de reemplazo aporta el arma que sustituye', () => {
    // Una mejora "↑ FOR X" sin arma dejaría al modelo sin nada que disparar.
    const sinArma: string[] = [];
    for (const entry of catalog.unitEntries) {
      for (const upgrade of entry.upgrades) {
        if (upgrade.replacesWeapon && upgrade.grantsWeapons.length === 0) {
          sinArma.push(`${entry.name} → ${upgrade.name}`);
        }
      }
    }
    expect(sinArma).toEqual([]);
  });

  it('toda carta de facción otorga al menos un espacio', () => {
    const broken = catalog.factionCards
      .filter((c) => Object.values(c.startingSlots).every((v) => !v))
      .map((c) => c.id);
    expect(broken).toEqual([]);
  });

  it('toda etiqueta de facción aparece en alguna carta de facción', () => {
    // Una unidad con una etiqueta que ninguna facción tiene sería inreclutable.
    const factionTags = new Set(
      catalog.factionCards.flatMap((c) => c.tags.map((t) => t.toUpperCase())),
    );
    const unreachable = catalog.unitEntries
      .filter((e) =>
        e.tags.some((t) => !factionTags.has(t.toUpperCase())),
      )
      .map((e) => e.id);
    expect(unreachable).toEqual([]);
  });
});

describe('Escenarios (comunes a las tres razas)', () => {
  const catalog = catalogs.get(races[0]!)!;

  it('los seedId de misión y despliegue son únicos', () => {
    const ids = [
      ...catalog.missionCards.map((c) => c.seedId),
      ...catalog.deploymentCards.map((c) => c.seedId),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toda carta de despliegue tiene imagen (el diagrama ES la carta)', () => {
    const missing = catalog.deploymentCards
      .filter((c) => !c.imageRef)
      .map((c) => c.id);
    expect(missing).toEqual([]);
  });

  it('cada misión existe en las escalas Standard y Skirmish', () => {
    const byName = new Map<string, Set<string>>();
    for (const m of catalog.missionCards) {
      if (!byName.has(m.name)) byName.set(m.name, new Set());
      byName.get(m.name)!.add(m.scale);
    }
    for (const [name, scales] of byName) {
      expect(
        { name, scales: [...scales].sort() },
        `${name} debería existir en ambas escalas`,
      ).toEqual({ name, scales: ['skirmish', 'standard'] });
    }
  });

  it('las cartas de escenario son idénticas en todas las razas cargadas', () => {
    // Hallazgo M1: si divergen, alguien ha duplicado los datos por raza.
    for (const race of races) {
      const other = catalogs.get(race)!;
      expect(other.missionCards).toEqual(catalog.missionCards);
      expect(other.deploymentCards).toEqual(catalog.deploymentCards);
    }
  });

  it('mantiene los valores impresos de Supply Drop en Skirmish', () => {
    const supplyDrop = catalog.missionCards.find(
      (mission) => mission.id === 'mission.supply_drop.skirmish',
    );
    expect(supplyDrop).toMatchObject({
      startingSupply: 4,
      gameLength: 4,
    });
  });
});
