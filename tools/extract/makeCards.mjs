#!/usr/bin/env node

/**
 * Generate the original card images used by the selection previews.
 *
 * The PDFs are kept as immutable sources. Poppler renders each source page at
 * a fixed DPI and sharp performs the deterministic crop/rotation afterwards.
 * The manifest deliberately stores coordinates in PDF points so a change in
 * render density cannot move a card boundary.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '../..');
const manifestPath = path.join(scriptDir, 'card-assets.manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const keepQa = process.argv.includes('--qa');
const tmpDir = path.join(rootDir, 'tmp', 'pdfs', 'card-crops');
const pagesDir = path.join(tmpDir, 'source-pages');
const publicDir = path.join(rootDir, 'public');
const dpi = Number(manifest.render.dpi);
const pointScale = dpi / 72;

function fail(message) {
  throw new Error(`[makeCards] ${message}`);
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function sha256(filePath) {
  return createHash('sha256').update(await readFile(filePath)).digest('hex').toUpperCase();
}

async function verifySources() {
  for (const [sourceId, source] of Object.entries(manifest.sources)) {
    const pdfPath = path.resolve(rootDir, source.path);
    if (!existsSync(pdfPath)) fail(`No existe el PDF fuente ${pdfPath}`);
    const actual = await sha256(pdfPath);
    if (actual !== source.sha256.toUpperCase()) {
      fail(`El hash de ${sourceId} no coincide: esperado ${source.sha256}, obtenido ${actual}`);
    }
  }
}

const renderedPages = new Map();
async function renderPage(sourceId, page) {
  const key = `${sourceId}:${page}`;
  const cached = renderedPages.get(key);
  if (cached) return cached;

  const source = manifest.sources[sourceId];
  if (!source) fail(`Fuente desconocida ${sourceId}`);
  if (!Number.isInteger(page) || page < 1 || page > source.pages) {
    fail(`Página ${page} fuera de rango para ${sourceId}`);
  }

  await mkdir(pagesDir, { recursive: true });
  const output = path.join(pagesDir, `${sourceId}-${page}.png`);
  if (!existsSync(output)) {
    execFileSync('pdftoppm', [
      '-singlefile',
      '-f', String(page),
      '-l', String(page),
      '-r', String(dpi),
      '-png',
      path.resolve(rootDir, source.path),
      path.join(pagesDir, `${sourceId}-${page}`),
    ], { stdio: 'inherit' });
  }

  const metadata = await sharp(output).metadata();
  const expectedWidth = Math.round(source.pageSizePt[0] * pointScale);
  const expectedHeight = Math.round(source.pageSizePt[1] * pointScale);
  if (metadata.width !== expectedWidth || metadata.height !== expectedHeight) {
    fail(`Tamaño inesperado en ${sourceId} p.${page}: ${metadata.width}×${metadata.height}; esperado ${expectedWidth}×${expectedHeight}`);
  }

  renderedPages.set(key, output);
  return output;
}

function pixelBounds(layout, asset) {
  if (asset.layout === 'unit') {
    const [x1, x2] = layout.x;
    const [y0, y1, y2] = layout.y;
    return {
      x1,
      y1: y0,
      x2,
      y2: y1,
      backY1: y1,
      backY2: y2,
    };
  }

  const [column, row] = asset.slot ?? [];
  if (!Number.isInteger(column) || !Number.isInteger(row)) {
    fail(`${asset.id} necesita un slot [columna, fila]`);
  }
  const [x1, x2, x3] = layout.x;
  const [y0, y1, y2, y3, y4] = layout.y;
  const xs = [x1, x2, x3];
  const ys = asset.layout === 'mission' ? [y0, y1, y2] : [y0, y1, y2, y3, y4];
  if (column < 0 || column >= xs.length - 1 || row < 0 || row >= ys.length - 1) {
    fail(`${asset.id} tiene un slot fuera de los límites de ${asset.layout}`);
  }
  const startRow = asset.layout === 'command' ? row * 2 : row;
  const rowHeight = asset.layout === 'command' ? 2 : 1;
  const endRow = startRow + rowHeight;
  if (endRow >= ys.length) fail(`${asset.id} no cabe en las bandas de ${asset.layout}`);
  return { x1: xs[column], x2: xs[column + 1], y1: ys[startRow], y2: ys[endRow] };
}

function toPixels(value) {
  return Math.round(value * pointScale);
}

function extractOptions(bounds, insetPt = 0) {
  const left = toPixels(bounds.x1 + insetPt);
  const top = toPixels(bounds.y1 + insetPt);
  const right = toPixels(bounds.x2 - insetPt);
  const bottom = toPixels(bounds.y2 - insetPt);
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

async function writeCard(input, output, bounds, rotation = 0) {
  const outputPath = path.resolve(publicDir, output);
  if (!isInside(publicDir, outputPath)) fail(`Salida fuera de public/: ${output}`);
  await mkdir(path.dirname(outputPath), { recursive: true });
  const pipeline = sharp(input).extract(extractOptions(bounds, Number(manifest.render.insetPt) || 0));
  if (rotation) pipeline.rotate(rotation);
  await pipeline.webp({
    quality: Number(manifest.render.quality),
    smartSubsample: Boolean(manifest.render.smartSubsample),
    effort: Number(manifest.render.effort),
  }).toFile(outputPath);
  return outputPath;
}

async function generateAsset(asset) {
  const input = await renderPage(asset.source, asset.page);
  const layout = manifest.layouts[asset.layout];
  if (!layout) fail(`Layout desconocido ${asset.layout}`);

  if (asset.layout === 'unit') {
    const bounds = pixelBounds(layout, asset);
    await writeCard(input, asset.output.front, bounds, layout.rotation.front);
    await writeCard(input, asset.output.back, { ...bounds, y1: bounds.backY1, y2: bounds.backY2 }, layout.rotation.back);
    return [asset.output.front, asset.output.back];
  }

  const bounds = pixelBounds(layout, asset);
  const rotation = asset.rotation ?? layout.rotation ?? 0;
  await writeCard(input, asset.output, bounds, rotation);
  return [asset.output];
}

async function createContactSheet(name, outputs) {
  const entries = [];
  for (const output of outputs) {
    const input = path.resolve(publicDir, output);
    const thumbnail = await sharp(input).resize({ width: 260, height: 280, fit: 'inside' }).png().toBuffer();
    entries.push({ input: thumbnail, left: (entries.length % 4) * 280 + 10, top: Math.floor(entries.length / 4) * 310 + 10 });
  }
  if (entries.length === 0) return;
  const width = Math.min(4, entries.length) * 280;
  const height = Math.ceil(entries.length / 4) * 310;
  await mkdir(tmpDir, { recursive: true });
  await sharp({ create: { width, height, channels: 4, background: '#f4f4f4' } })
    .composite(entries)
    .jpeg({ quality: 90 })
    .toFile(path.join(tmpDir, `contact-${name}.jpg`));
}

await verifySources();
await mkdir(publicDir, { recursive: true });

const generated = [];
for (const asset of manifest.assets) {
  generated.push(...await generateAsset(asset));
}

if (keepQa) {
  const byGroup = new Map();
  for (const asset of manifest.assets) {
    const outputs = typeof asset.output === 'string' ? [asset.output] : Object.values(asset.output);
    const group = asset.layout === 'unit' ? `${asset.source}-units` : asset.layout === 'command' ? `${asset.source}-command` : asset.layout;
    byGroup.set(group, [...(byGroup.get(group) ?? []), ...outputs]);
  }
  for (const [group, outputs] of byGroup) await createContactSheet(group, outputs);
}

const sizes = await Promise.all(generated.map(async (output) => (await stat(path.resolve(publicDir, output))).size));
const totalBytes = sizes.reduce((sum, size) => sum + size, 0);
console.log(`[makeCards] Generadas ${generated.length} imágenes (${(totalBytes / 1024 / 1024).toFixed(1)} MiB) a ${dpi} dpi.`);

if (!keepQa) {
  await rm(tmpDir, { recursive: true, force: true });
} else {
  console.log(`[makeCards] QA guardada en ${tmpDir}`);
}
