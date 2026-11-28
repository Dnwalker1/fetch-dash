import Phaser from 'phaser';
import { artScale } from './paint';
import { PALETTES, RUN_FRAMES, makePetTextures, petKey, type PetChoice } from './pets';
import { makeSheetAnim, marksFor, queueSheet, sheetFor, sheetFrameUrls, sheetKeys, sheetReady } from './sheets';
import { BREED_FIT, BREED_ORIGIN_X, BREED_RES, CELL, breedById, breedDir, breedFrameUrls, breedKey, breedReady, dogKey, layersFor, makeBreedAnim, queueBreed, shapeOption } from './breeds';
import { CAT_FIT, CAT_ORIGIN_X, CAT_RES, catFrameUrls, catKey, catLayersFor, catReady, makeCatAnim, queueCat } from './cats';

/**
 * The dog's breed choice, for a dog only: switching to a cat keeps the dog's
 * breed in the choice (so switching back restores it), and it must not draw
 * the cat as that breed.
 */
function dogOf(c: PetChoice): PetChoice['dog'] {
  return c.species === 'dog' ? c.dog : undefined;
}

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
  const dog = dogOf(c);
  if (dog) return queueBreed(scene, dog);
  const sheet = sheetFor(c);
  if (sheet) return queueSheet(scene, sheet, marksFor(sheet, c));
  if (c.species === 'cat') return queueCat(scene, c.palette);
  return false;
}

/** How the pet is drawn: its painted sheet (or the painted cat) once that's loaded, otherwise the code-drawn pet. */
export function petLookFor(scene: Phaser.Scene, c: PetChoice): PetLook {
  const dog = dogOf(c);
  if (dog && breedReady(scene, dog)) {
    const [base, ...rest] = layersFor(dog);
    const k = (layer: string) => ({ run: breedKey(dog!.breed, layer, 'run'), jump: breedKey(dog!.breed, layer, 'jump'), slide: breedKey(dog!.breed, layer, 'slide') });
    const b = k(base.layer);
    return {
      anim: makeBreedAnim(scene, dog),
      idle: b.run,
      jump: b.jump,
      slide: b.slide,
      stand: DOG_STAND,
      // each body's own size setting (1 = as painted); the hit box does not change
      scale: (BREED_FIT * (breedById(dog.breed)?.fit ?? 1)) / BREED_RES,
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

// ---------- Extra poses: from behind, standing, the catch, swimming ----------

/**
 * The poses painted beyond run, jump and slide (see docs/painted-pets.md):
 * strips are { frame size, frame count }, the rest are single pictures.
 */
const POSES = {
  'back-run': { w: 189, h: 112, n: 8 },
  'back-lean-left': { w: 189, h: 112, n: 8 },
  'back-lean-right': { w: 189, h: 112, n: 8 },
  'back-jump': undefined,
  ready: { w: 189, h: 150, n: 4 },
  catch: { w: 189, h: 150, n: 4 },
  swim: { w: 189, h: 112, n: 6 },
  dive: undefined,
} as const;
export type Pose = keyof typeof POSES;
export const BACK_POSES: Pose[] = ['back-run', 'back-jump', 'back-lean-left', 'back-lean-right'];

/** Each layer this pet draws (base first), with its texture key and file for a pose. None for the code-drawn pet. */
function poseLayers(c: PetChoice): { key: (p: Pose) => string; url: (p: Pose) => string }[] | undefined {
  const dog = dogOf(c);
  if (dog) {
    const b = dog.breed;
    return layersFor(dog).map((l) => ({ key: (p) => `pet-${b}-${l.layer}-${p}`, url: (p) => `${breedDir(b)}${l.layer}-${p}.webp` }));
  }
  const sheet = sheetFor(c);
  if (sheet) {
    // (no sheet has marking layers painted in these poses yet)
    if (!sheet.poses || marksFor(sheet, c).length) return undefined;
    return [{ key: (p) => `pet-${sheet.id}-${p}`, url: (p) => `${sheet.dir}${p}.webp` }];
  }
  if (c.species === 'cat') return catLayersFor(c.palette).map((l) => ({ key: (p) => `pet-cat-${l.layer}-${p}`, url: (p) => `art/pets/cat/${l.layer}-${p}.webp` }));
  return undefined;
}

/** Queues these poses for every layer the pet draws. Returns true if anything was queued. */
export function queuePoses(scene: Phaser.Scene, c: PetChoice, poses: Pose[]): boolean {
  let queued = false;
  for (const layer of poseLayers(c) ?? []) {
    for (const p of poses) {
      const key = layer.key(p);
      if (scene.textures.exists(key)) continue;
      const strip = POSES[p];
      if (strip) scene.load.spritesheet(key, layer.url(p), { frameWidth: strip.w, frameHeight: strip.h });
      else scene.load.image(key, layer.url(p));
      queued = true;
    }
  }
  return queued;
}

/** The base layer's key and each mark's key for a pose, if every layer of it is loaded. */
function poseKeys(scene: Phaser.Scene, c: PetChoice, look: PetLook, p: Pose): { base: string; marks: string[] } | undefined {
  const layers = poseLayers(c);
  // the side-on look must be the painted one too, so the marks line up layer for layer
  if (!layers || layers.length !== look.marks.length + 1 || look.stand === undefined) return undefined;
  const keys = layers.map((l) => l.key(p));
  if (!keys.every((k) => scene.textures.exists(k))) return undefined;
  return { base: keys[0], marks: keys.slice(1) };
}

/** A loop on a strip, named like the strip (or `key-name` for part of it). */
function stripAnim(scene: Phaser.Scene, key: string, rate: number, frames?: number[], name?: string, once = false): string {
  const anim = name ? `${key}-${name}` : key;
  if (!scene.anims.exists(anim)) {
    const n = scene.textures.get(key).frameTotal - 1;
    const pick = frames ?? Array.from({ length: n }, (_, i) => i);
    scene.anims.create({ key: anim, frames: pick.map((frame) => ({ key, frame })), frameRate: rate, repeat: once ? 0 : -1 });
  }
  return anim;
}

/**
 * The pet from behind, once every picture it needs is loaded. Undefined
 * otherwise (no back view painted, or it didn't load): the run into the
 * screen then shows the side-on pet, as before.
 */
export function backLookFor(scene: Phaser.Scene, c: PetChoice, look: PetLook): BackLook | undefined {
  const [run, jump, left, right] = BACK_POSES.map((p) => poseKeys(scene, c, look, p));
  if (!run || !jump || !left || !right) return undefined;
  return {
    anim: stripAnim(scene, run.base, CELL.frameRate),
    leanLeft: stripAnim(scene, left.base, CELL.frameRate),
    leanRight: stripAnim(scene, right.base, CELL.frameRate),
    jump: jump.base,
    marks: run.marks.map((r, i) => ({ run: r, jump: jump.marks[i], leanLeft: left.marks[i], leanRight: right.marks[i] })),
  };
}

/**
 * Standing (a tail wag), the ball catch, swimming and the dive, for the
 * poses that are loaded. A pose that isn't (or the code-drawn pet) is left
 * out, and the game uses the run, jump and slide pictures instead.
 */
export interface ExtraLook {
  /** the standing loop, with a tail wag */
  ready?: string;
  /** the catch strip: anims `${catch}-trot` (with the ball) and `${catch}-stop` (braking, then a proud stand, held) */
  catch?: string;
  /** the paddling loop, head above the water */
  swim?: string;
  /** under the water but for the ears and top of the head */
  dive?: string;
  /** base texture key -> each mark's texture key, for every extra pose */
  marks: Map<string, string[]>;
}

export function extraLookFor(scene: Phaser.Scene, c: PetChoice, look: PetLook): ExtraLook {
  const out: ExtraLook = { marks: new Map() };
  const pose = (p: Pose) => {
    const k = poseKeys(scene, c, look, p);
    if (k) out.marks.set(k.base, k.marks);
    return k?.base;
  };
  const ready = pose('ready');
  if (ready) out.ready = stripAnim(scene, ready, 8);
  const catchKey = pose('catch');
  if (catchKey) {
    stripAnim(scene, catchKey, 8, [0, 1], 'trot');
    stripAnim(scene, catchKey, 6, [2, 3], 'stop', true);
    out.catch = catchKey;
  }
  const swim = pose('swim');
  if (swim) out.swim = stripAnim(scene, swim, 10);
  out.dive = pose('dive');
  return out;
}

/** The pet's painted card picture (fully painted, not tinted), or none for the code-drawn pet. */
export function cardArtUrl(c: PetChoice): string | undefined {
  const dog = dogOf(c);
  if (dog) {
    const b = breedById(dog.breed);
    if (!b) return undefined;
    let name = `card-${dog.coat in b.coats ? dog.coat : b.defaultCoat}`;
    // the default shape has no suffix
    for (const g of ['ears', 'tail'] as const) {
      const opt = shapeOption(dog, g);
      if (opt && opt !== b.variants[g]?.[0]) name += `-${g}-${opt}`;
    }
    return `${breedDir(b.id)}${name}.webp`;
  }
  const sheet = sheetFor(c);
  if (sheet) return sheet.poses ? `${sheet.dir}card.webp` : undefined;
  return c.species === 'cat' ? `art/pets/cat/card-${c.palette}.webp` : undefined;
}

/** Data URLs of a pet's run frames, for the little flipbooks on the cards. */
export function petFrameUrls(scene: Phaser.Scene, c: PetChoice, cache: Map<string, string[]>): string[] {
  const dog = dogOf(c);
  if (dog && breedReady(scene, dog)) {
    const key = `${dog.breed}|${dogKey(dog)}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const frames = breedFrameUrls(scene, dog);
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
