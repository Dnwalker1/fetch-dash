import Phaser from 'phaser';
import { PALETTES } from './pets';
import { BREED_FIT, BREED_ORIGIN_X, BREED_RES, CELL, type CoatLayer } from './breeds';

/**
 * The painted cat (see docs/painted-pets.md). It replaces the code-drawn cat
 * (drawCat in pets.ts), which stays only as the stand-in while these load.
 *
 * One cat body, painted in layers with the same cells as the dog sheets:
 * run 1512x112 (8 cells of 189x112), jump 176x150, slide 198x79, painted at
 * 2x, nose on the right and paws on the bottom edge. The back-view states
 * for the horizon runs use the same cells: back-run, back-lean-left and
 * back-lean-right 1512x112 (8 cells), back-jump 176x150.
 *
 * The cat's coat is the player's PALETTES pick, the same 7 colors the drawn
 * cat used, mapped the way drawCat used them:
 *   coat        tinted with the palette's fur color (body, head, legs)
 *   coat-black  painted black, used instead of coat for dark furs (black)
 *   mark-light  tinted with the palette's light color (muzzle, chest, belly)
 *   mark-dark   tinted with the palette's dark color (the tail, darker toward the tip)
 *   detail      never tinted: green eyes, pink nose and inner ears, white whiskers, paw pads
 * Files: public/art/pets/cat/<layer>-<state>.webp. Keys: pet-cat-<layer>-<state>.
 */

export type CatState = 'run' | 'jump' | 'slide' | 'back-run' | 'back-jump' | 'back-lean-left' | 'back-lean-right';
export const CAT_SIDE: readonly CatState[] = ['run', 'jump', 'slide'];
export const CAT_BACK: readonly CatState[] = ['back-run', 'back-jump', 'back-lean-left', 'back-lean-right'];
/** States that are 8-frame strips (the rest are single pictures). */
const STRIPS: readonly CatState[] = ['run', 'back-run', 'back-lean-left', 'back-lean-right'];

export const CAT_FIT = BREED_FIT;
export const CAT_RES = BREED_RES;
export const CAT_ORIGIN_X = BREED_ORIGIN_X;

/** Same rule as sheets.ts: furs darker than this get the painted black coat instead of a tint. */
function isDark(fur: number): boolean {
  return ((fur >> 16) & 255) * 0.3 + ((fur >> 8) & 255) * 0.59 + (fur & 255) * 0.11 < 90;
}

/** Layers back to front, with tints, for a palette. layers[0] is the base, the one that animates. */
export function catLayersFor(palette: string): CoatLayer[] {
  const p = PALETTES[palette] ?? PALETTES.grey;
  const base: CoatLayer = isDark(p.fur) ? { layer: 'coat-black' } : { layer: 'coat', tint: p.fur };
  return [base, { layer: 'mark-light', tint: p.light }, { layer: 'mark-dark', tint: p.dark }, { layer: 'detail' }];
}

export function catKey(layer: string, st: CatState): string {
  return `pet-cat-${layer}-${st}`;
}

/** True once every layer this cat draws is loaded for the given states. */
export function catReady(scene: Phaser.Scene, palette: string, states: readonly CatState[] = CAT_SIDE): boolean {
  return catLayersFor(palette).every((l) => states.every((st) => scene.textures.exists(catKey(l.layer, st))));
}

/** Queues only the sheets this cat draws (side states by default). Returns true if anything was queued. */
export function queueCat(scene: Phaser.Scene, palette: string, states: readonly CatState[] = CAT_SIDE): boolean {
  let queued = false;
  for (const { layer } of catLayersFor(palette)) {
    for (const st of states) {
      const k = catKey(layer, st);
      if (scene.textures.exists(k)) continue;
      const url = `art/pets/cat/${layer}-${st}.webp`;
      if (STRIPS.includes(st)) scene.load.spritesheet(k, url, { frameWidth: CELL.frameWidth, frameHeight: CELL.frameHeight });
      else scene.load.image(k, url);
      queued = true;
    }
  }
  return queued;
}

/** Makes (once) an 8-frame animation on the base layer's strip. Returns its key. */
export function makeCatAnim(scene: Phaser.Scene, palette: string, st: CatState = 'run'): string {
  const k = catKey(catLayersFor(palette)[0].layer, st);
  if (!scene.anims.exists(k)) {
    scene.anims.create({ key: k, frames: scene.anims.generateFrameNumbers(k, { start: 0, end: CELL.frames - 1 }), frameRate: CELL.frameRate, repeat: -1 });
  }
  return k;
}

/** The back-view keys for the horizon runs (queue them first with queueCat(scene, palette, CAT_BACK)). */
export function catBackLook(scene: Phaser.Scene, palette: string) {
  const [base, ...rest] = catLayersFor(palette);
  const k = (layer: string) => ({ run: catKey(layer, 'back-run'), jump: catKey(layer, 'back-jump'), leanLeft: catKey(layer, 'back-lean-left'), leanRight: catKey(layer, 'back-lean-right') });
  return {
    anim: makeCatAnim(scene, palette, 'back-run'),
    leanLeft: makeCatAnim(scene, palette, 'back-lean-left'),
    leanRight: makeCatAnim(scene, palette, 'back-lean-right'),
    jump: catKey(base.layer, 'back-jump'),
    tint: base.tint,
    marks: rest.map((l) => ({ ...k(l.layer), tint: l.tint, alpha: l.alpha })),
  };
}

/** The run frames as picture URLs for the cards' flipbook: every layer, tinted, stacked. */
export function catFrameUrls(scene: Phaser.Scene, palette: string): string[] {
  const layers = catLayersFor(palette);
  const tmp = document.createElement('canvas');
  return Array.from({ length: CELL.frames }, (_, i) => {
    const cv = document.createElement('canvas');
    cv.width = CELL.frameWidth;
    cv.height = CELL.frameHeight;
    const g = cv.getContext('2d')!;
    for (const l of layers) {
      const fr = scene.textures.getFrame(catKey(l.layer, 'run'), i);
      tmp.width = fr.cutWidth;
      tmp.height = fr.cutHeight;
      const t = tmp.getContext('2d')!;
      t.clearRect(0, 0, tmp.width, tmp.height);
      t.drawImage(fr.source.image as CanvasImageSource, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
      if (l.tint !== undefined) {
        // multiply by the tint, then keep only the layer's own shape
        t.globalCompositeOperation = 'multiply';
        t.fillStyle = `#${l.tint.toString(16).padStart(6, '0')}`;
        t.fillRect(0, 0, tmp.width, tmp.height);
        t.globalCompositeOperation = 'destination-in';
        t.drawImage(fr.source.image as CanvasImageSource, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
        t.globalCompositeOperation = 'source-over';
      }
      g.globalAlpha = l.alpha ?? 1;
      g.drawImage(tmp, 0, 0);
      g.globalAlpha = 1;
    }
    return cv.toDataURL();
  });
}
