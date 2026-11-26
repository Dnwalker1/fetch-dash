import Phaser from 'phaser';
import { artScale } from './paint';
import { PALETTES, RUN_FRAMES, makePetTextures, petKey, type PetChoice } from './pets';
import { makeSheetAnim, marksFor, queueSheet, sheetFor, sheetFrameUrls, sheetKeys, sheetReady } from './sheets';
import { BREED_FIT, BREED_ORIGIN_X, BREED_RES, CELL, breedDir, breedFrameUrls, breedKey, breedReady, dogKey, layersFor, makeBreedAnim, queueBreed } from './breeds';
import { CAT_BACK, CAT_FIT, CAT_ORIGIN_X, CAT_RES, catBackLook, catFrameUrls, catKey, catLayersFor, catReady, makeCatAnim, queueCat } from './cats';

/** The textures the pet is drawn with right now (a painted sheet, or the code-drawn pet). */
export interface PetLook {
  anim: string;
  idle: string;
  jump: string;
  slide: string;
  /** the frame of `idle` the pet stands on while it waits to run (undefined: the texture's own picture) */
  stand?: number;
  /** sprite scale at Size 'medium' */
  scale: number;
  /** where the hit box center sits across the picture */
  originX: number;
  /** coat color for a tinted sheet */
  tint?: number;
  /** layers drawn over the base, back to front (markings, ears, bandana, eyes...) */
  marks: { run: string; jump: string; slide: string; tint?: number; alpha?: number }[];
  /** see-through amount of the base layer */
  alpha?: number;
}

/**
 * The pet seen from behind, for the runs into the screen. `anim`, `leanLeft`
 * and `leanRight` are animations on the base layer's strips (each named like
 * its strip); the marks are the same layers as the side-on look's, in the
 * same order, so their tints carry over.
 */
export interface BackLook {
  anim: string;
  leanLeft: string;
  leanRight: string;
  jump: string;
  marks: { run: string; leanLeft: string; leanRight: string; jump: string }[];
}

/**
 * The run frame that reads most like standing (legs under the body), for the
 * "Tap to run" wait and the finish. Dogs: the contact frame; the cat: its stride.
 */
const DOG_STAND = 2;
const CAT_STAND = 4;

/** Queues the pet's painted pictures (breed layers, a sheet or the painted cat). Returns false if there was nothing to load. */
export function queuePetArt(scene: Phaser.Scene, c: PetChoice): boolean {
  if (c.dog) return queueBreed(scene, c.dog);
  const sheet = sheetFor(c);
  if (sheet) return queueSheet(scene, sheet, marksFor(sheet, c));
  if (c.species === 'cat') return queueCat(scene, c.palette);
  return false;
}

/** How the pet is drawn: its painted sheet (or the painted cat) once that's loaded, otherwise the code-drawn pet. */
export function petLookFor(scene: Phaser.Scene, c: PetChoice): PetLook {
  if (c.dog && breedReady(scene, c.dog)) {
    const [base, ...rest] = layersFor(c.dog);
    const k = (layer: string) => ({ run: breedKey(c.dog!.breed, layer, 'run'), jump: breedKey(c.dog!.breed, layer, 'jump'), slide: breedKey(c.dog!.breed, layer, 'slide') });
    const b = k(base.layer);
    return {
      anim: makeBreedAnim(scene, c.dog),
      idle: b.run,
      jump: b.jump,
      slide: b.slide,
      stand: DOG_STAND,
      scale: BREED_FIT / BREED_RES,
      originX: BREED_ORIGIN_X,
      tint: base.tint,
      alpha: base.alpha,
      marks: rest.map((l) => ({ ...k(l.layer), tint: l.tint, alpha: l.alpha })),
    };
  }
  const sheet = sheetFor(c);
  const marks = sheet ? marksFor(sheet, c) : [];
  if (sheet && sheetReady(scene, sheet, marks)) {
    makeSheetAnim(scene, sheet);
    const k = sheetKeys(sheet);
    return {
      anim: k.anim,
      idle: k.run,
      jump: k.jump,
      slide: k.slide,
      stand: DOG_STAND,
      scale: sheet.fit / sheet.res,
      originX: sheet.originX,
      tint: sheet.coat === 'tint' ? PALETTES[c.palette].fur : undefined,
      marks: marks.map((m) => sheetKeys(sheet, m)),
    };
  }
  if (c.species === 'cat' && catReady(scene, c.palette)) {
    // the painted cat, tinted to the player's coat color
    const [base, ...rest] = catLayersFor(c.palette);
    const k = (layer: string) => ({ run: catKey(layer, 'run'), jump: catKey(layer, 'jump'), slide: catKey(layer, 'slide') });
    const b = k(base.layer);
    return {
      anim: makeCatAnim(scene, c.palette),
      idle: b.run,
      jump: b.jump,
      slide: b.slide,
      stand: CAT_STAND,
      scale: CAT_FIT / CAT_RES,
      originX: CAT_ORIGIN_X,
      tint: base.tint,
      alpha: base.alpha,
      marks: rest.map((l) => ({ ...k(l.layer), tint: l.tint, alpha: l.alpha })),
    };
  }
  // the code-drawn pet: dogs with no painted look, and the cat while its sheets load (or if they fail)
  makePetTextures(scene, c);
  const key = petKey(c);
  return { anim: `${key}-run`, idle: `${key}-run-0`, jump: `${key}-jump`, slide: `${key}-slide`, scale: artScale(scene, `${key}-run-0`), originX: 0.5, marks: [] };
}

// ---------- From behind, for the runs into the screen ----------

const BACK = ['back-run', 'back-jump', 'back-lean-left', 'back-lean-right'] as const;
type BackState = (typeof BACK)[number];

/** The texture keys and files of every back-view picture this pet draws, or none if it has no back view. */
function backFiles(c: PetChoice): { key: string; url: string; strip: boolean }[][] | undefined {
  const files = (key: (st: BackState) => string, url: (st: BackState) => string) => BACK.map((st) => ({ key: key(st), url: url(st), strip: st !== 'back-jump' }));
  if (c.dog) {
    const b = c.dog.breed;
    return layersFor(c.dog).map((l) => files((st) => `pet-${b}-${l.layer}-${st}`, (st) => `${breedDir(b)}${l.layer}-${st}.webp`));
  }
  const sheet = sheetFor(c);
  if (sheet) {
    // (no sheet has marking layers painted from behind yet)
    if (!sheet.back || marksFor(sheet, c).length) return undefined;
    return [files((st) => `pet-${sheet.id}-${st}`, (st) => `${sheet.dir}${st}.webp`)];
  }
  if (c.species === 'cat') return catLayersFor(c.palette).map((l) => files((st) => catKey(l.layer, st), (st) => `art/pets/cat/${l.layer}-${st}.webp`));
  return undefined;
}

/** Queues the pet's back-view pictures (for a level with runs into the screen). Returns true if anything was queued. */
export function queueBackArt(scene: Phaser.Scene, c: PetChoice): boolean {
  if (!c.dog && !sheetFor(c) && c.species === 'cat') return queueCat(scene, c.palette, CAT_BACK);
  let queued = false;
  for (const layer of backFiles(c) ?? []) {
    for (const f of layer) {
      if (scene.textures.exists(f.key)) continue;
      if (f.strip) scene.load.spritesheet(f.key, f.url, { frameWidth: CELL.frameWidth, frameHeight: CELL.frameHeight });
      else scene.load.image(f.key, f.url);
      queued = true;
    }
  }
  return queued;
}

/** An 8-frame loop on a strip, named like the strip. */
function stripAnim(scene: Phaser.Scene, key: string): string {
  if (!scene.anims.exists(key)) {
    scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: CELL.frames - 1 }), frameRate: CELL.frameRate, repeat: -1 });
  }
  return key;
}

/**
 * The pet from behind, once every picture it needs is loaded. Undefined
 * otherwise (no back view painted, or it didn't load): the run into the
 * screen then shows the side-on pet, as before.
 */
export function backLookFor(scene: Phaser.Scene, c: PetChoice, look: PetLook): BackLook | undefined {
  if (!c.dog && !sheetFor(c) && c.species === 'cat') {
    if (!catReady(scene, c.palette, CAT_BACK) || look.idle !== catKey(catLayersFor(c.palette)[0].layer, 'run')) return undefined;
    const b = catBackLook(scene, c.palette);
    return { anim: b.anim, leanLeft: b.leanLeft, leanRight: b.leanRight, jump: b.jump, marks: b.marks };
  }
  const layers = backFiles(c);
  // the side-on look must be the painted one too, so the marks line up layer for layer
  if (!layers || layers.length !== look.marks.length + 1 || look.stand === undefined) return undefined;
  if (!layers.every((l) => l.every((f) => scene.textures.exists(f.key)))) return undefined;
  const keys = layers.map(([run, jump, leanLeft, leanRight]) => ({ run: run.key, jump: jump.key, leanLeft: leanLeft.key, leanRight: leanRight.key }));
  const [base, ...rest] = keys;
  return { anim: stripAnim(scene, base.run), leanLeft: stripAnim(scene, base.leanLeft), leanRight: stripAnim(scene, base.leanRight), jump: base.jump, marks: rest };
}

/** Data URLs of a pet's run frames, for the little flipbooks on the cards. */
export function petFrameUrls(scene: Phaser.Scene, c: PetChoice, cache: Map<string, string[]>): string[] {
  if (c.dog && breedReady(scene, c.dog)) {
    const key = `${c.dog.breed}|${dogKey(c.dog)}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const frames = breedFrameUrls(scene, c.dog);
    cache.set(key, frames);
    return frames;
  }
  const sheet = sheetFor(c);
  const marks = sheet ? marksFor(sheet, c) : [];
  const painted = sheet && sheetReady(scene, sheet, marks);
  if (!painted && !sheet && c.species === 'cat' && catReady(scene, c.palette)) {
    const ck = `cat|${c.palette}`;
    const hit = cache.get(ck);
    if (hit) return hit;
    const frames = catFrameUrls(scene, c.palette);
    cache.set(ck, frames);
    return frames;
  }
  const key = painted ? `${sheet.id}|${sheet.coat === 'tint' ? c.palette : ''}|${marks.join(',')}` : petKey(c);
  const cached = cache.get(key);
  if (cached) return cached;
  let frames: string[];
  if (painted) {
    frames = sheetFrameUrls(scene, sheet, sheet.coat === 'tint' ? PALETTES[c.palette].fur : undefined, marks);
  } else {
    makePetTextures(scene, c);
    frames = Array.from({ length: RUN_FRAMES }, (_, i) => scene.textures.getBase64(`${key}-run-${i}`) as string);
  }
  cache.set(key, frames);
  return frames;
}
