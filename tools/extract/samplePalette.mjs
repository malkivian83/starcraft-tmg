/**
 * Muestrea los colores de acento de las cartas de cada raza.
 *
 * Renderiza la primera página de cada hoja a PPM (que es RGB sin comprimir y
 * por tanto trivial de leer) y agrupa los píxeles saturados por tono para
 * quedarse con el dominante. Así el color de la interfaz sale de las cartas
 * y no de una suposición.
 *
 * Uso:  node tools/extract/samplePalette.mjs
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SHEETS = {
  ZERG: 'docs/StarCraft-Zerg-P2P-Card-Sheets-A4_EN.pdf',
  TERRAN: 'docs/StarCraft-Terran-P2P-Card-Sheets-A4_EN.pdf',
  PROTOSS: 'docs/StarCraft-Protoss-P2P-Card-Sheets-A4_EN.pdf',
};

function readPpm(path) {
  const buf = readFileSync(path);
  let offset = 0;
  const token = () => {
    while (/\s/.test(String.fromCharCode(buf[offset]))) offset++;
    const start = offset;
    while (!/\s/.test(String.fromCharCode(buf[offset]))) offset++;
    return buf.toString('latin1', start, offset);
  };
  token(); // P6
  const width = Number(token());
  const height = Number(token());
  token(); // maxval
  offset++;
  return { width, height, data: buf.subarray(offset) };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

const hex = (r, g, b) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

for (const [race, pdf] of Object.entries(SHEETS)) {
  const dir = mkdtempSync(join(tmpdir(), 'sctmg-pal-'));
  try {
    execFileSync('pdftoppm', ['-r', '60', '-f', '1', '-l', '1', pdf, join(dir, 'p')]);
    const file = readdirSync(dir).find((f) => f.endsWith('.ppm'));
    const { width, height, data } = readPpm(join(dir, file));

    // Se agrupan por tono los píxeles con color de verdad: se descartan grises
    // (poca saturación) y los extremos de luminosidad, que son fondo y texto.
    const buckets = new Map();
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
      const [h, s, l] = rgbToHsl(r, g, b);
      if (s < 0.35 || l < 0.18 || l > 0.82) continue;
      const key = Math.round(h / 12) * 12;
      const acc = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
      acc.n++; acc.r += r; acc.g += g; acc.b += b;
      buckets.set(key, acc);
    }

    const top = [...buckets.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 3)
      .map(([tono, a]) => `tono ${String(tono).padStart(3)}° ${hex(a.r / a.n, a.g / a.n, a.b / a.n)} (${a.n} px)`);

    console.log(`${race.padEnd(8)} ${top.join('   ')}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
