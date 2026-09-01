import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { availableRaces, loadCatalog } from '@/catalog/loader';

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(path.join(root, 'tools/extract/card-assets.manifest.json'), 'utf8'),
) as {
  assets: Array<{
    id: string;
    source: string;
    page: number;
    layout: string;
    output: string | { front: string; back: string };
  }>;
};

function manifestOutputs(): string[] {
  return manifest.assets.flatMap((asset) =>
    typeof asset.output === 'string'
      ? [asset.output]
      : [asset.output.front, asset.output.back],
  );
}

function publicPath(ref: string): string {
  const clean = ref.replace(/^\/+/, '');
  const resolved = path.resolve(root, 'public', clean);
  const publicRoot = path.resolve(root, 'public') + path.sep;
  if (!resolved.toLowerCase().startsWith(publicRoot.toLowerCase())) {
    throw new Error(`Ruta fuera de public/: ${ref}`);
  }
  return resolved;
}

describe('assets de cartas originales', () => {
  it('cubre todos los refs del catálogo y no tiene rutas duplicadas', () => {
    const catalogRefs: string[] = [];
    for (const race of availableRaces()) {
      const catalog = loadCatalog(race).catalog;
      for (const card of [...catalog.factionCards, ...catalog.tacticalCards, ...catalog.creepCards]) {
        expect(card.imageRef, card.id).toBeTruthy();
        catalogRefs.push(card.imageRef!);
      }
      for (const card of catalog.unitCards) {
        expect(card.imageRefFront, card.id).toBeTruthy();
        expect(card.imageRefBack, card.id).toBeTruthy();
        catalogRefs.push(card.imageRefFront!, card.imageRefBack!);
      }
    }

    const scenarios = loadCatalog(availableRaces()[0]!).catalog;
    for (const mission of scenarios.missionCards) {
      expect(mission.imageRef, mission.id).toBeTruthy();
      catalogRefs.push(mission.imageRef!);
    }
    for (const deployment of scenarios.deploymentCards) {
      expect(deployment.originalImageRef, deployment.id).toBeTruthy();
      catalogRefs.push(deployment.originalImageRef!);
    }

    const generated = manifestOutputs();
    expect(generated).toHaveLength(109);
    expect(new Set(generated).size).toBe(generated.length);
    expect(new Set(catalogRefs)).toEqual(new Set(generated));
    for (const ref of generated) {
      const file = publicPath(ref);
      expect(existsSync(file), ref).toBe(true);
      expect(statSync(file).size, ref).toBeGreaterThan(1000);
    }
  });

  it('conserva los diagramas de despliegue existentes fuera del recorte original', () => {
    const catalog = loadCatalog('ZERG').catalog;
    for (const deployment of catalog.deploymentCards) {
      const file = publicPath(deployment.imageRef);
      expect(existsSync(file), deployment.id).toBe(true);
      expect(statSync(file).size, deployment.id).toBeGreaterThan(1000);
    }
  });

  it('mantiene la orientación visual de cada perfil', async () => {
    for (const asset of manifest.assets) {
      const outputs = typeof asset.output === 'string'
        ? [asset.output]
        : [asset.output.front, asset.output.back];
      for (const output of outputs) {
        const metadata = await sharp(publicPath(output)).metadata();
        expect(metadata.width, `${asset.id}/${output}`).toBeDefined();
        expect(metadata.height, `${asset.id}/${output}`).toBeDefined();
        if (asset.layout === 'mission') {
          expect(metadata.height!).toBeGreaterThan(metadata.width!);
        } else {
          expect(metadata.width!).toBeGreaterThan(metadata.height!);
        }
      }
    }
  });
});
