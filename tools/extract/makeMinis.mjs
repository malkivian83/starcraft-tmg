/**
 * Extrae de las hojas de cartas la foto de miniatura de cada unidad.
 *
 * Cada página contiene una carta; el retrato es la imagen en color apaisada
 * en vertical (aprox. 1:2). Para saber a qué unidad pertenece se lee el texto
 * de esa misma página y se busca el nombre de la unidad: así el mapeo no
 * depende del orden de las páginas, que no está documentado en ningún sitio.
 *
 * Uso:  node tools/extract/makeMinis.mjs
 * Requiere Poppler (pdfimages, pdftotext, pdfinfo) en el PATH.
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Páginas cuyo nombre de carta no está en la capa de texto del PDF (va como
 * gráfico vectorial), así que el mapeo automático no puede resolverlas.
 * Identificadas mirando el retrato: la página 8 son bichos en peana de 40 mm
 * de la familia Roach, y la 10 son Zerglings morados en peana de 25 mm.
 */
const PAGE_OVERRIDES = {
  zerg: {
    8: 'zerg.card.corpser',
    10: 'zerg.card.kerrigan_swarm_raptor',
  },
  terran: {
    // La página del Point Defense Drone y la del Raider mencionan "Marine".
    // Sin esta asignación explícita el detector acababa guardando el retrato
    // del dron como si fuera el del Raider.
    5: 'terran.card.point_defense_drone',
    6: 'terran.card.raynors_raider',
  },
};

const SOURCES = [
  {
    race: 'zerg',
    pdf: 'docs/StarCraft-Zerg-P2P-Card-Sheets-A4_EN.pdf',
    catalog: 'src/catalog/data/zerg.json',
  },
  {
    race: 'terran',
    pdf: 'docs/StarCraft-Terran-P2P-Card-Sheets-A4_EN.pdf',
    catalog: 'src/catalog/data/terran.json',
  },
  {
    race: 'protoss',
    pdf: 'docs/StarCraft-Protoss-P2P-Card-Sheets-A4_EN.pdf',
    catalog: 'src/catalog/data/protoss.json',
  },
];

const run = (cmd, args) =>
  execFileSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function pageCount(pdf) {
  const info = run('pdfinfo', [pdf]);
  return Number(/^Pages:\s+(\d+)$/m.exec(info)?.[1] ?? 0);
}

/** Lista de imágenes de una página, en el mismo orden en que se extraen. */
function listImages(pdf, page) {
  const out = run('pdfimages', ['-list', '-f', String(page), '-l', String(page), pdf]);
  return out
    .split('\n')
    .slice(2)
    .map((line) => line.trim().split(/\s+/))
    .filter((cols) => cols.length > 6 && cols[2] === 'image')
    .map((cols) => ({
      width: Number(cols[3]),
      height: Number(cols[4]),
      color: cols[5],
    }));
}

async function main() {
  const catalogs = await Promise.all(
    SOURCES.map(async (source) => ({
      ...source,
      data: (await import(`../../${source.catalog}`, { with: { type: 'json' } }))
        .default,
    })),
  );

  for (const { race, pdf, data } of catalogs) {
    const outDir = `public/cards/${race}`;
    mkdirSync(outDir, { recursive: true });

    // Nombre de carta -> identificador, para buscarlo en el texto de la página.
    const cards = data.unitCards.map((card) => ({
      id: card.id,
      // "Raptor (Zergling)" se imprime como "RAPTOR" a secas en la carta.
      needle: card.name.replace(/\s*\(.*\)\s*/, '').trim().toUpperCase(),
      slug: card.id.split('.').pop(),
    }));

    const pages = pageCount(pdf);
    const found = new Map();

    for (let page = 1; page <= pages; page++) {
      const text = run('pdftotext', [
        '-f', String(page), '-l', String(page), pdf, '-',
      ]).toUpperCase();

      /*
       * La página de una cepa menciona también el nombre base: la del
       * "Raptor (Zergling)" contiene "ZERGLING", y la del "Vile (Roach)"
       * contiene "ROACH". Si se eligiera solo por nombre más largo, la cepa
       * se quedaría sin retrato y el de la unidad base se asignaría dos veces.
       *
       * Se descartan las cartas que ya tienen retrato y, entre las que
       * quedan, gana la de nombre más específico.
       */
      const overrideId = PAGE_OVERRIDES[race]?.[page];
      const match = overrideId
        ? cards.find((card) => card.id === overrideId)
        : cards
            .filter((card) => text.includes(card.needle) && !found.has(card.id))
            .sort((a, b) => b.needle.length - a.needle.length)[0];
      if (!match || found.has(match.id)) continue;

      const images = listImages(pdf, page);
      const portraitIndex = images.findIndex(
        (img) =>
          img.color !== 'gray' &&
          img.height > img.width * 1.6 &&
          img.width >= 200,
      );
      if (portraitIndex === -1) continue;

      const dir = mkdtempSync(join(tmpdir(), 'sctmg-mini-'));
      try {
        run('pdfimages', ['-j', '-f', String(page), '-l', String(page), pdf, join(dir, 'p')]);
        const files = readdirSync(dir).sort();
        const file = files[portraitIndex];
        if (!file) continue;

        const target = join(outDir, `mini-${match.slug}.jpg`);
        copyFileSync(join(dir, file), target);
        found.set(match.id, target);
        console.log(
          `${match.id.padEnd(34)} pág. ${String(page).padStart(2)}  ${(statSync(target).size / 1024).toFixed(0)} KB`,
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }

    const missing = cards.filter((c) => !found.has(c.id)).map((c) => c.id);
    if (missing.length > 0) {
      console.log(`  sin retrato (${race}): ${missing.join(', ')}`);
    }
  }
}

await main();
