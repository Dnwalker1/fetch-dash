// Writes tools/mypet/rig.json: every look the game can draw today (each
// breed, coat and ear or tail option, and the cat in each palette), as the
// stack of layers the game draws, with tints. The Python prototype reads it,
// so the layer rules stay in one place (src/art/breeds.ts and cats.ts).
//
//   node tools/mypet/export-rig.mjs
import { build } from 'esbuild';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const tmp = mkdtempSync(join(tmpdir(), 'mypet-rig-'));
const stub = join(tmp, 'phaser-stub.mjs');
writeFileSync(stub, 'export default {};\n');
const entry = join(tmp, 'entry.ts');
writeFileSync(entry, `
export { BREEDS, layersFor } from ${JSON.stringify(join(root, 'src/art/breeds.ts'))};
export { catLayersFor } from ${JSON.stringify(join(root, 'src/art/cats.ts'))};
export { PALETTES } from ${JSON.stringify(join(root, 'src/art/pets.ts'))};
`);
const out = join(tmp, 'rig.mjs');
await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'esm', outfile: out, alias: { phaser: stub }, logLevel: 'error' });
const { BREEDS, layersFor, catLayersFor, PALETTES } = await import(pathToFileURL(out).href);
rmSync(tmp, { recursive: true, force: true });

const hex = (n) => (n === undefined ? undefined : `#${n.toString(16).padStart(6, '0')}`);
const stack = (layers) => layers.map((l) => ({ layer: l.layer, tint: hex(l.tint), alpha: l.alpha }));

const looks = [];
for (const b of BREEDS) {
  const ears = b.variants.ears ?? [undefined];
  const tails = b.variants.tail ?? [undefined];
  for (const [coat, c] of Object.entries(b.coats)) {
    for (const e of ears) {
      for (const t of tails) {
        const choice = { breed: b.id, coat, ...(e ? { ears: e } : {}), ...(t ? { tail: t } : {}) };
        const id = [b.id, coat, e && `ears-${e}`, t && `tail-${t}`].filter(Boolean).join('/');
        const label = [b.label, c.label.toLowerCase(), e && `${e} ears`, t && `${t} tail`].filter(Boolean).join(', ');
        looks.push({ id, species: 'dog', label, dir: `public/art/pets/${b.id}/`, choice, layers: stack(layersFor(choice)) });
        if (b.features.muzzle) {
          looks.push({ id: `${id}/gray-muzzle`, species: 'dog', label: `${label}, gray muzzle`, dir: `public/art/pets/${b.id}/`, choice: { ...choice, muzzle: true }, layers: stack(layersFor({ ...choice, muzzle: true })) });
        }
      }
    }
  }
}
for (const [p, pal] of Object.entries(PALETTES)) {
  looks.push({ id: `cat/${p}`, species: 'cat', label: `Cat, ${pal.label.toLowerCase()}`, dir: 'public/art/pets/cat/', choice: { palette: p }, layers: stack(catLayersFor(p)) });
}

// Every pose painted per pet (src/art/petLook.ts POSES, plus run, jump, slide).
const poses = {
  run: { w: 189, h: 112, n: 8 },
  jump: { w: 176, h: 150, n: 1 },
  slide: { w: 198, h: 79, n: 1 },
  ready: { w: 189, h: 150, n: 4 },
  catch: { w: 189, h: 150, n: 4 },
  swim: { w: 189, h: 112, n: 6 },
  dive: { w: 189, h: 112, n: 1 },
  'back-run': { w: 189, h: 112, n: 8 },
  'back-lean-left': { w: 189, h: 112, n: 8 },
  'back-lean-right': { w: 189, h: 112, n: 8 },
  'back-jump': { w: 176, h: 150, n: 1 },
};

writeFileSync(join(here, 'rig.json'), JSON.stringify({ note: 'Made by tools/mypet/export-rig.mjs from src/art. Do not edit by hand.', poses, looks }, null, 1) + '\n');
console.log(`rig.json: ${looks.length} looks`);
