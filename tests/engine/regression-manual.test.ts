import { describe, expect, it } from 'vitest';
import { computeCosts } from '@/engine/costing';
import { validateList } from '@/engine/validate';
import { indexFor, manualExampleList } from '../fixtures';

/**
 * Caso de regresión principal (SDD §10).
 *
 * Las cifras esperadas están IMPRESAS en el reglamento §9.1. No las hemos
 * calculado nosotros: las publica el fabricante del juego. Si esta prueba
 * falla, o el catálogo tiene un dato mal transcrito o el motor aplica mal una
 * regla — y es la única prueba capaz de distinguir ambas cosas de un fallo
 * silencioso.
 */
describe("Ejemplo del manual §9.1 — Raynor's Raiders", () => {
  const index = indexFor('TERRAN');
  const list = manualExampleList();

  it('gasta exactamente 1670 minerales en unidades', () => {
    // Manual: "1670 Total Minerals used on Units."
    expect(computeCosts(list, index).mineralsSpent).toBe(1670);
  });

  it('gasta exactamente 185 de gas vespeno en cartas tácticas', () => {
    // Manual: "25 + 40 + 35 + 25 + 35 + 25 = 185 Vespene Gas spent"
    expect(computeCosts(list, index).vespeneSpent).toBe(185);
  });

  it('tiene un presupuesto de gas de 200 (10 % de 2000)', () => {
    expect(computeCosts(list, index).vespeneLimit).toBe(200);
  });

  it('reproduce el desglose de espacios impreso en el manual', () => {
    const { slots } = computeCosts(list, index);

    // Manual: 8/8 CORE, 1/1 HERO, 2/3 SUPPORT, 0/1 AIR, 2/2 ELITE
    expect([slots.CORE.used, slots.CORE.total]).toEqual([8, 8]);
    expect([slots.HERO.used, slots.HERO.total]).toEqual([1, 1]);
    expect([slots.SUPPORT.used, slots.SUPPORT.total]).toEqual([2, 3]);
    expect([slots.AIR.used, slots.AIR.total]).toEqual([0, 1]);
    expect([slots.ELITE.used, slots.ELITE.total]).toEqual([2, 2]);
  });

  it('es una lista legal', () => {
    const result = validateList(list, index);
    expect(result.errors).toEqual([]);
    expect(result.legal).toBe(true);
  });

  it('avisa de los 330 minerales y 15 de gas sin gastar', () => {
    const { warnings } = validateList(list, index);
    expect(warnings.find((w) => w.rule === 'A1')?.message.es).toContain('330');
    expect(warnings.find((w) => w.rule === 'A2')?.message.es).toContain('15');
  });

  it('avisa de los espacios de Apoyo y Aéreo sin usar', () => {
    const { warnings } = validateList(list, index);
    const slotWarnings = warnings.filter((w) => w.rule === 'A3');
    expect(slotWarnings.map((w) => w.message.es).join(' ')).toContain('Apoyo');
    expect(slotWarnings.map((w) => w.message.es).join(' ')).toContain('Aéreo');
  });

  it('acumula el recurso por ronda de facción y tácticas', () => {
    // Raynor's Raiders (+1) + Barracks (+1) + Barracks Proxy (+2) +
    // Factory (+1) + Orbital Command (+1) + Academy (+1) + Eng. Bay (+1) = 8
    const summary = computeCosts(list, index);
    expect(summary.resourceType).toBe('CP');
    expect(summary.resourcePerRound).toBe(8);
  });

  it('registra en el libro mayor qué carta aporta cada espacio', () => {
    const { slots } = computeCosts(list, index);
    const coreSources = Object.fromEntries(
      slots.CORE.grantedBy.map((g) => [g.cardId, g.amount]),
    );
    expect(coreSources['terran.faction.raynors_raiders']).toBe(3);
    expect(coreSources['terran.tactical.barracks_proxy']).toBe(2);
    expect(slots.ELITE.grantedBy).toEqual([
      { cardId: 'terran.tactical.factory', cardName: 'Factory', amount: 2 },
    ]);
  });
});
