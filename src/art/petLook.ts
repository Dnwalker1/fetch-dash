import Phaser from 'phaser';
import { artScale } from './paint';
import { PALETTES, RUN_FRAMES, makePetTextures, petKey, type PetChoice } from './pets';
import { makeSheetAnim, marksFor, sheetFor, sheetFrameUrls, sheetKeys, sheetReady } from './sheets';

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
  /** marking layers drawn over the coat */
  marks: { run: string; jump: string; slide: string }[];
}

/** How the pet is drawn: its painted sheet once that's loaded, otherwise the code-drawn pet. */
export function petLookFor(scene: Phaser.Scene, c: PetChoice): PetLook {
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
