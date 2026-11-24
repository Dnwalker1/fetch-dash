import Phaser from 'phaser';
import { artScale } from './paint';
import { PALETTES, RUN_FRAMES, makePetTextures, petKey, type PetChoice } from './pets';
import { makeSheetAnim, marksFor, queueSheet, sheetFor, sheetFrameUrls, sheetKeys, sheetReady } from './sheets';
import { BREED_FIT, BREED_ORIGIN_X, BREED_RES, breedFrameUrls, breedKey, breedReady, dogKey, layersFor, makeBreedAnim, queueBreed } from './breeds';

/** The textures the pet is drawn with right now (a painted sheet, or the code-drawn pet). */
export interface PetLook {
  anim: string;
  idle: string;
  jump: string;
  slide: string;
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

/** Queues the pet's painted pictures (breed layers or a sheet). Returns false if there was nothing to load. */
export function queuePetArt(scene: Phaser.Scene, c: PetChoice): boolean {
  if (c.dog) return queueBreed(scene, c.dog);
  const sheet = sheetFor(c);
  return sheet ? queueSheet(scene, sheet, marksFor(sheet, c)) : false;
}

/** How the pet is drawn: its painted sheet once that's loaded, otherwise the code-drawn pet. */
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
      scale: sheet.fit / sheet.res,
      originX: sheet.originX,
      tint: sheet.coat === 'tint' ? PALETTES[c.palette].fur : undefined,
      marks: marks.map((m) => sheetKeys(sheet, m)),
    };
  }
  makePetTextures(scene, c);
  const key = petKey(c);
  return { anim: `${key}-run`, idle: `${key}-run-0`, jump: `${key}-jump`, slide: `${key}-slide`, scale: artScale(scene, `${key}-run-0`), originX: 0.5, marks: [] };
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
