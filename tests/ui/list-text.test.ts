import { describe, expect, it } from 'vitest';
import { computeCosts } from '@/engine/costing';
import { validateList } from '@/engine/validate';
import { formatListAsText } from '@/ui/print/listText';
import { entry, emptyList, indexFor, manualExampleList } from '../fixtures';

const labels: Record<string, string> = {
  minerals: 'minerales', gas: 'gas', perRound: 'por ronda', supply: 'suministro',
  invalid: 'LISTA NO VÁLIDA', commandCards: 'CARTAS DE MANDO', faction: 'Facción',
  creep: 'Creep', tactics: 'Tácticas', armySlots: 'ESPACIOS DE EJÉRCITO',
  units: 'UNIDADES', models: 'Miniaturas', supplyShort: 'Sum.', slot: 'Espacio',
  upgrades: 'Mejoras', noValue: '—', total: 'Total', summoned: 'UNIDADES INVOCADAS',
  draftScenarios: 'ESCENARIOS QUE LLEVO AL DRAFT', missions: 'Misiones',
  deployments: 'Despliegues', scaleStandard: 'Estándar', scaleSkirmish: 'Escaramuza',
  scaleGrandOffensive: 'Gran Ofensiva', seedLink: 'ENLACE PARA COPIAR LA LISTA', seed: 'Seed',
};

const t = (key: string) => labels[key] ?? key;

function textFor(list = manualExampleList()) {
  const index = indexFor(list.race);
  return formatListAsText(
    { list, index, summary: computeCosts(list, index), validation: validateList(list, index) },
    t,
    'es',
    { url: 'https://example.test/es/crear-lista?seed=SCT1-TEST-SEED' },
  );
}

describe('formato de lista para copiar en texto', () => {
  it('incluye el resumen de la hoja, pero no las fichas de unidad', () => {
    const text = textFor();

    expect(text).toContain("*Raynor's Raiders — ejemplo del manual §9.1*");
    expect(text).toContain('_TERRAN · Estándar');
    expect(text).toContain('*CARTAS DE MANDO*');
    expect(text).toContain('*Facción:*');
    expect(text).toContain('*UNIDADES*');
    expect(text).toContain('*Marine*');
    expect(text).toContain('*ENLACE PARA COPIAR LA LISTA*');
    expect(text).not.toContain('**Marine**');
    const marineLine = text.split('\n').find((line) => line.includes('*Marine*')) ?? '';
    expect(marineLine).not.toContain('Miniaturas');
    expect(marineLine).not.toContain('Espacio');
    expect(marineLine).not.toContain('minerales');
    expect(text).not.toContain('*Total:*');
    expect(text).toContain('ESCENARIOS QUE LLEVO AL DRAFT');
    expect(text).toContain('https://example.test/es/crear-lista?seed=SCT1-TEST-SEED');
    expect(text).not.toContain('Seed:');
    expect(text).not.toContain('Perfil de unidad');
    expect(text).not.toContain('Habilidades');
    expect(text).not.toContain('Armas');
  });

  it('separa las unidades invocadas del bloque que cuenta para la lista', () => {
    const list = emptyList({
      entries: [entry('zerg.entry.roachling', '3', [], true)],
    });
    const text = textFor(list);
    const summonedStart = text.indexOf('*UNIDADES INVOCADAS*');

    expect(summonedStart).toBeGreaterThan(-1);
    expect(text.slice(0, summonedStart)).not.toContain('Roachling');
    expect(text.slice(summonedStart)).toContain('Roachling');
  });
});
