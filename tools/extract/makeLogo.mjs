/**
 * Extrae el logotipo del reglamento y lo guarda como PNG con transparencia.
 *
 * El PDF guarda el logo en dos partes: la imagen RGB y una máscara de opacidad
 * («smask») aparte. Al extraerlas por separado, el logo sale con fondo negro,
 * que sirve para la interfaz oscura pero no para la hoja impresa en blanco.
 * Este script las recombina en un PNG RGBA.
 *
 * Uso:  node tools/extract/makeLogo.mjs
 * Requiere Poppler (pdfimages) en el PATH.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zlibSync } from 'fflate';

const PDF = 'docs/StarCraft-TMG_EN.pdf';
const OUT = 'public/logo.png';
/** El logo mide 1042×298 en el PDF; se reduce a la mitad para la web. */
const DOWNSCALE = 2;

// --- Lectura de formatos crudos de Netpbm ----------------------------------
// pdfimages sin opciones escribe PPM (color) y PGM (gris), que son cabecera de
// texto + bytes sin comprimir. Así se evita tener que decodificar PNG o JPEG.

function readNetpbm(path) {
  const buffer = readFileSync(path);
  let offset = 0;
  const token = () => {
    while (offset < buffer.length) {
      const char = String.fromCharCode(buffer[offset]);
      if (char === '#') {
        while (offset < buffer.length && buffer[offset] !== 0x0a) offset++;
      } else if (/\s/.test(char)) {
        offset++;
      } else break;
    }
    let start = offset;
    while (offset < buffer.length && !/\s/.test(String.fromCharCode(buffer[offset]))) {
      offset++;
    }
    return buffer.toString('latin1', start, offset);
  };

  const magic = token();
  const width = Number(token());
  const height = Number(token());
  const maxValue = Number(token());
  offset++; // el único byte en blanco tras la cabecera

  if (maxValue !== 255) throw new Error(`Profundidad no soportada: ${maxValue}`);
  const channels = magic === 'P6' ? 3 : 1;
  return {
    width,
    height,
    channels,
    data: buffer.subarray(offset, offset + width * height * channels),
  };
}

// --- Codificación PNG -------------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(data)]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(width, height, rgba) {
  // Una línea de filtro 0 por fila: sin predicción, el deflate hace el trabajo.
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy
      ? rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4)
      : raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (1 + width * 4) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', Buffer.from(zlibSync(raw, { level: 9 }))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- Proceso ----------------------------------------------------------------

const dir = mkdtempSync(join(tmpdir(), 'sctmg-logo-'));
execFileSync('pdfimages', ['-f', '1', '-l', '1', PDF, join(dir, 'img')]);

const files = readdirSync(dir).sort();
const images = files.map((name) => ({ name, ...readNetpbm(join(dir, name)) }));

/**
 * pdfimages escribe SIEMPRE en PPM de 3 canales, también las máscaras en
 * escala de grises. Se detecta una máscara comprobando que R = G = B.
 */
function isGrayscale({ data, channels }) {
  if (channels !== 3) return true;
  for (let i = 0; i < data.length; i += 3 * 997) {
    if (data[i] !== data[i + 1] || data[i + 1] !== data[i + 2]) return false;
  }
  return true;
}

// El logo es la imagen apaisada más ancha que NO es una máscara.
const colour = images
  .filter((i) => i.width > i.height * 2 && !isGrayscale(i))
  .sort((a, b) => b.width - a.width)[0];
if (!colour) throw new Error('No se encontró el logotipo en la página 1.');

const mask = images.find(
  (i) =>
    i !== colour &&
    i.width === colour.width &&
    i.height === colour.height &&
    isGrayscale(i),
);
if (!mask) throw new Error('No se encontró la máscara de opacidad del logotipo.');
const maskStride = mask.channels;

const outWidth = Math.floor(colour.width / DOWNSCALE);
const outHeight = Math.floor(colour.height / DOWNSCALE);
const rgba = Buffer.alloc(outWidth * outHeight * 4);

for (let y = 0; y < outHeight; y++) {
  for (let x = 0; x < outWidth; x++) {
    // Promedio del bloque DOWNSCALE×DOWNSCALE: reducir tomando un solo píxel
    // dejaría los bordes del logo dentados.
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let dy = 0; dy < DOWNSCALE; dy++) {
      for (let dx = 0; dx < DOWNSCALE; dx++) {
        const sx = x * DOWNSCALE + dx;
        const sy = y * DOWNSCALE + dy;
        if (sx >= colour.width || sy >= colour.height) continue;
        const ci = (sy * colour.width + sx) * 3;
        r += colour.data[ci];
        g += colour.data[ci + 1];
        b += colour.data[ci + 2];
        a += mask.data[(sy * mask.width + sx) * maskStride];
        n++;
      }
    }
    const oi = (y * outWidth + x) * 4;
    rgba[oi] = Math.round(r / n);
    rgba[oi + 1] = Math.round(g / n);
    rgba[oi + 2] = Math.round(b / n);
    rgba[oi + 3] = Math.round(a / n);
  }
}

writeFileSync(OUT, encodePng(outWidth, outHeight, rgba));
console.log(`${OUT} — ${outWidth}×${outHeight}`);
