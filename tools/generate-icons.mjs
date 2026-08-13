/*
 * Genera los iconos de la aplicación (PNG y SVG) a partir del arte de
 * `icon-art.mjs`.
 *
 *   node tools/generate-icons.mjs [directorio-de-salida]
 *
 * El rasterizador es propio y sin dependencias a propósito: las librerías
 * habituales de imagen traen binarios y scripts de instalación, y este
 * repositorio controla `allowScripts` de forma estricta. Solo hace falta
 * rellenar unos pocos trazados planos, así que basta con un relleno por
 * líneas de barrido y el `zlib` de Node para escribir el PNG.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { CANVAS, COLORS, SHAPES } from './icon-art.mjs';

const OUTPUT_DIR =
  process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/* Sub-líneas por píxel: el eje X se resuelve de forma analítica, así que solo
 * el vertical necesita sobremuestreo. Con 8 el borde ya no escalona. */
const SUBSAMPLES = 8;

// ---------------------------------------------------------------------------
// Trazados
// ---------------------------------------------------------------------------

const ARGUMENT_COUNT = { M: 2, L: 2, C: 6, Z: 0 };

/**
 * Convierte un trazado (subconjunto M/L/C/Z, coordenadas absolutas) en
 * polilíneas ya escaladas a píxeles de destino.
 */
function flattenPath(data, scale) {
  const tokens = data.trim().split(/[\s,]+/);
  const contours = [];
  let current = null;
  let cursor = [0, 0];
  let start = [0, 0];

  const point = (x, y) => [x * scale, y * scale];

  for (let i = 0; i < tokens.length; ) {
    const command = tokens[i];
    i += 1;
    const count = ARGUMENT_COUNT[command];
    if (count === undefined) throw new Error(`Comando de trazado no soportado: ${command}`);
    const values = tokens.slice(i, i + count).map(Number);
    i += count;

    if (command === 'M') {
      current = [point(values[0], values[1])];
      contours.push(current);
      cursor = [values[0], values[1]];
      start = cursor;
    } else if (command === 'L') {
      current.push(point(values[0], values[1]));
      cursor = [values[0], values[1]];
    } else if (command === 'C') {
      const [x0, y0] = cursor;
      const [c1x, c1y, c2x, c2y, x, y] = values;
      // El polígono de control acota la longitud del arco: sirve para elegir
      // cuántos tramos hacen falta sin que se note la faceta.
      const controlLength =
        Math.hypot(c1x - x0, c1y - y0) + Math.hypot(c2x - c1x, c2y - c1y) + Math.hypot(x - c2x, y - c2y);
      const steps = Math.min(96, Math.max(8, Math.ceil((controlLength * scale) / 3)));
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        const u = 1 - t;
        const bx = u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x;
        const by = u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y;
        current.push(point(bx, by));
      }
      cursor = [x, y];
    } else if (command === 'Z') {
      cursor = start;
    }
  }
  return contours;
}

// ---------------------------------------------------------------------------
// Rasterizado
// ---------------------------------------------------------------------------

/** Aristas no horizontales, listas para el barrido. */
function buildEdges(contours) {
  const edges = [];
  for (const contour of contours) {
    for (let i = 0; i < contour.length; i += 1) {
      const [x0, y0] = contour[i];
      const [x1, y1] = contour[(i + 1) % contour.length];
      if (y0 === y1) continue;
      edges.push({ x0, y0, x1, y1, winding: y1 > y0 ? 1 : -1 });
    }
  }
  return edges;
}

/**
 * Cobertura por píxel de un trazado relleno, en [0,1], con regla non-zero.
 * Cada sub-línea aporta tramos con extremos fraccionarios, de modo que el
 * antialias horizontal es exacto y el vertical queda en 1/SUBSAMPLES.
 */
function rasterize(contours, size) {
  const coverage = new Float32Array(size * size);
  const edges = buildEdges(contours);
  if (edges.length === 0) return coverage;

  const weight = 1 / SUBSAMPLES;
  const crossings = [];

  for (let row = 0; row < size; row += 1) {
    for (let sub = 0; sub < SUBSAMPLES; sub += 1) {
      const y = row + (sub + 0.5) / SUBSAMPLES;
      crossings.length = 0;
      for (const edge of edges) {
        const top = Math.min(edge.y0, edge.y1);
        const bottom = Math.max(edge.y0, edge.y1);
        if (y < top || y >= bottom) continue;
        const t = (y - edge.y0) / (edge.y1 - edge.y0);
        crossings.push({ x: edge.x0 + t * (edge.x1 - edge.x0), winding: edge.winding });
      }
      if (crossings.length < 2) continue;
      crossings.sort((a, b) => a.x - b.x);

      let winding = 0;
      for (let i = 0; i < crossings.length - 1; i += 1) {
        winding += crossings[i].winding;
        if (winding === 0) continue;
        const spanStart = Math.max(0, crossings[i].x);
        const spanEnd = Math.min(size, crossings[i + 1].x);
        if (spanEnd <= spanStart) continue;

        const firstPixel = Math.floor(spanStart);
        const lastPixel = Math.min(size - 1, Math.floor(spanEnd - 1e-9));
        const rowOffset = row * size;
        for (let pixel = firstPixel; pixel <= lastPixel; pixel += 1) {
          const overlap = Math.min(spanEnd, pixel + 1) - Math.max(spanStart, pixel);
          if (overlap > 0) coverage[rowOffset + pixel] += overlap * weight;
        }
      }
    }
  }
  return coverage;
}

function parseColor(hex) {
  const value = hex.replace('#', '');
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

/** Compone un trazado relleno sobre el lienzo RGBA (source-over). */
function fillShape(pixels, size, contours, color) {
  const coverage = rasterize(contours, size);
  const [red, green, blue] = parseColor(color);
  for (let i = 0; i < coverage.length; i += 1) {
    const alpha = Math.min(1, coverage[i]);
    if (alpha <= 0) continue;
    const offset = i * 4;
    const destinationAlpha = pixels[offset + 3] / 255;
    const outAlpha = alpha + destinationAlpha * (1 - alpha);
    for (let channel = 0; channel < 3; channel += 1) {
      const source = [red, green, blue][channel];
      const destination = pixels[offset + channel];
      pixels[offset + channel] = Math.round(
        (source * alpha + destination * destinationAlpha * (1 - alpha)) / outAlpha,
      );
    }
    pixels[offset + 3] = Math.round(outAlpha * 255);
  }
}

/** Fondo: cuadrado completo, o cuadrado de esquinas redondeadas si hay radio. */
function backgroundPath(radius) {
  if (!radius) return `M 0 0 L ${CANVAS} 0 L ${CANVAS} ${CANVAS} L 0 ${CANVAS} Z`;
  const r = radius;
  const k = r * 0.5523; // Aproximación de un cuarto de círculo con un cúbico.
  const max = CANVAS;
  return [
    `M ${r} 0`,
    `L ${max - r} 0`,
    `C ${max - r + k} 0 ${max} ${r - k} ${max} ${r}`,
    `L ${max} ${max - r}`,
    `C ${max} ${max - r + k} ${max - r + k} ${max} ${max - r} ${max}`,
    `L ${r} ${max}`,
    `C ${r - k} ${max} 0 ${max - r + k} 0 ${max - r}`,
    `L 0 ${r}`,
    `C 0 ${r - k} ${r - k} 0 ${r} 0`,
    'Z',
  ].join(' ');
}

/** Escala el arte respecto del centro del lienzo. */
function scaleAboutCenter(data, factor) {
  const tokens = data.trim().split(/[\s,]+/);
  const output = [];
  for (let i = 0; i < tokens.length; ) {
    const command = tokens[i];
    i += 1;
    const count = ARGUMENT_COUNT[command];
    output.push(command);
    for (let argument = 0; argument < count; argument += 2) {
      const x = CANVAS / 2 + (Number(tokens[i]) - CANVAS / 2) * factor;
      const y = CANVAS / 2 + (Number(tokens[i + 1]) - CANVAS / 2) * factor;
      output.push(x.toFixed(2), y.toFixed(2));
      i += 2;
    }
  }
  return output.join(' ');
}

function shapesFor({ artScale = 1, cornerRadius = 0 }) {
  const shapes = [{ d: backgroundPath(cornerRadius), fill: COLORS.background }];
  for (const shape of SHAPES) {
    shapes.push({ d: artScale === 1 ? shape.d : scaleAboutCenter(shape.d, artScale), fill: shape.fill });
  }
  return shapes;
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(pixels, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bits por canal
  header[9] = 6; // RGBA
  // Filtro 0 por línea: el arte son planos de color, comprime de sobra.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let row = 0; row < size; row += 1) {
    const source = row * size * 4;
    raw[row * (size * 4 + 1)] = 0;
    pixels.copy(raw, row * (size * 4 + 1) + 1, source, source + size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export function renderPng(size, options) {
  const pixels = Buffer.alloc(size * size * 4);
  for (const shape of shapesFor(options)) {
    fillShape(pixels, size, flattenPath(shape.d, size / CANVAS), shape.fill);
  }
  return encodePng(pixels, size);
}

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------

function renderSvg(options) {
  const paths = shapesFor(options)
    .map((shape) => `  <path d="${shape.d}" fill="${shape.fill}"/>`)
    .join('\n');
  // Con `width`/`height` explícitos el SVG tiene tamaño intrínseco; sin ellos
  // algunos navegadores lo dibujan a 150 px al usarlo como favicon.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}" width="${CANVAS}" height="${CANVAS}">\n${paths}\n</svg>\n`;
}

// ---------------------------------------------------------------------------

/* Redondeo de las esquinas del icono normal, en unidades del lienzo de 512. */
const CORNER_RADIUS = 112;
/* El icono normal no lo recorta nadie, así que el arte puede crecer un poco;
 * más de esto y las patas se meten en el redondeo de las esquinas. */
const ART_SCALE = 1.05;

const OUTPUTS = [
  { file: 'icon-192.png', size: 192, artScale: ART_SCALE, cornerRadius: CORNER_RADIUS },
  // `maskable`: Android recorta en círculo, el arte se queda en la zona segura.
  { file: 'icon-512.png', size: 512, artScale: 1, cornerRadius: 0 },
  // iOS aplica su propia máscara sobre un cuadrado a sangre.
  { file: 'apple-touch-icon.png', size: 180, artScale: ART_SCALE, cornerRadius: 0 },
];

// Solo escribe si se ejecuta como script; importarlo (para previsualizar, por
// ejemplo) no debe tocar `public/`.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const { file, size, ...options } of OUTPUTS) {
    writeFileSync(join(OUTPUT_DIR, file), renderPng(size, options));
    console.log(`${file} (${size}×${size})`);
  }

  writeFileSync(
    join(OUTPUT_DIR, 'favicon.svg'),
    renderSvg({ artScale: ART_SCALE, cornerRadius: CORNER_RADIUS }),
  );
  console.log('favicon.svg');
  writeFileSync(join(OUTPUT_DIR, 'icon.svg'), renderSvg({ artScale: 1, cornerRadius: 0 }));
  console.log('icon.svg');
}
