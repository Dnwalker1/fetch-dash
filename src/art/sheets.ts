import Phaser from 'phaser';
import { PALETTES, type PetChoice, type Species } from './pets';

/**
 * Painted pet sprites (made in Grok), used in place of the code-drawn pet.
 *
 * The plan: a small library of run sheets by body type (a runner's look
 * comes mostly from its build, ears, coat length and tail, not its exact
 * breed). Each is painted in a light, neutral coat so the game can tint it
 * to the pet's color, with markings (white chest, socks, tabby stripes)
 * painted as separate layers that can be turned on or off. Colors that
 * don't tint well (black) get a dark version of the sheet. Design Your Pet
 * looks at the photo and returns a body type and main colors along with the
 * portrait; the game picks the sheet and the tint, and the player can change
 * either.
 *
 * A character sheet (like Chewy) is one particular pet painted in its own
 * colors: it isn't tinted.
 *
 * Files for a sheet live in public/<dir>: run.webp (all run frames in one
 * row), jump.webp and slide.webp, plus run-<marking>.webp, jump-<marking>.webp
 * and slide-<marking>.webp for each marking layer (same cells, transparent
 * elsewhere).
 */

/** Body types the sheet library is planned around. */
export const BODY_TYPES = {
  dog: {
    'retriever-feathered': 'Retriever',
    'retriever-smooth': 'Lab',
    shepherd: 'Shepherd',
    husky: 'Husky',
    'small-fluffy': 'Small fluffy',
    'small-smooth': 'Small smooth',
    doodle: 'Doodle',
    bully: 'Bulldog or pit',
    dachshund: 'Dachshund',
    hound: 'Hound',
    spaniel: 'Spaniel',
  },
  cat: {
    'short-hair': 'Short-hair',
    'long-hair': 'Long-hair',
    chunky: 'Chunky',
    slim: 'Slim',
  },
} as const;

export type BodyType = keyof (typeof BODY_TYPES)['dog'] | keyof (typeof BODY_TYPES)['cat'];

export interface PaintedSheet {
  id: string;
  /** shown on the setup card */
  label: string;
  species: Species;
  bodyType: BodyType;
  /** 'fixed': one pet in its own colors. 'tint': a neutral coat tinted to the pet's color. */
  coat: 'fixed' | 'tint';
  /** for tinted sheets: the id of the same body painted in a dark coat, used for dark colors */
  dark?: string;
  /** marking layers painted for this sheet */
  markings?: string[];
  /** folder under public/, ending in '/' */
  dir: string;
  run: { frameWidth: number; frameHeight: number; frames: number; frameRate: number };
  /** canvas pixels per game pixel it was painted at */
  res: number;
  /** extra size, so the body matches the drawn pets at the same Size setting */
  fit: number;
  /**
   * Where the pet's hit box center sits across the picture (0 = left, 1 = right).
   * Long dogs sit back from center, so the nose doesn't reach far past the
   * hit box and look like it touches things that don't count as a bump.
   */
  originX: number;
  /** painted from behind too, for the runs into the screen: back-run, back-jump, back-lean-left and back-lean-right.webp */
  back?: boolean;
}

export const SHEETS: PaintedSheet[] = [
  {
    id: 'chewy',
    label: 'Chewy',
    species: 'dog',
    bodyType: 'retriever-feathered',
    coat: 'fixed',
    dir: 'art/pets/chewy/',
    // 8 frames: extend, front-land, contact, gather-a, gather-b, push, back-drive, reach.
    // Nose at each cell's right edge, paws on its bottom edge.
    run: { frameWidth: 189, frameHeight: 112, frames: 8, frameRate: 16 },
    res: 2,
    fit: 1.15,
    originX: 0.66,
    back: true,
  },
];

export function sheetById(id: string | undefined): PaintedSheet | undefined {
  return id ? SHEETS.find((s) => s.id === id) : undefined;
}

/** Painted looks a player can pick for this species. */
export function sheetsFor(species: Species): PaintedSheet[] {
  return SHEETS.filter((s) => s.species === species);
}

/** The sheet for a body type (as Design Your Pet will report it), if one is painted yet. */
export function sheetForBodyType(species: Species, body: string): PaintedSheet | undefined {
  return SHEETS.find((s) => s.species === species && s.bodyType === body && s.coat === 'tint') ?? SHEETS.find((s) => s.species === species && s.bodyType === body);
}

/** Black and dark brown don't come out well by tinting a light coat. */
function isDarkCoat(fur: number): boolean {
  return ((fur >> 16) & 255) * 0.3 + ((fur >> 8) & 255) * 0.59 + (fur & 255) * 0.11 < 90;
}

/** The sheet to draw a pet with, or none for the code-drawn pet. */
export function sheetFor(c: PetChoice): PaintedSheet | undefined {
  const s = sheetById(c.look);
  if (!s || s.species !== c.species) return undefined;
  if (s.coat === 'tint' && s.dark && isDarkCoat(PALETTES[c.palette].fur)) return sheetById(s.dark) ?? s;
  return s;
}

/** Texture keys of a sheet (and of one marking layer, if given). */
export function sheetKeys(s: PaintedSheet, mark?: string): { run: string; jump: string; slide: string; anim: string } {
  const k = mark ? `pet-${s.id}-${mark}` : `pet-${s.id}`;
  return { run: `${k}-run`, jump: `${k}-jump`, slide: `${k}-slide`, anim: `${k}-run` };
}

/** The marking layers to draw for a pet on this sheet. */
export function marksFor(s: PaintedSheet, c: PetChoice): string[] {
  return (c.markings ?? []).filter((m) => s.markings?.includes(m));
}

/** True once the sheet's pictures (and the pet's marking layers) are loaded. */
export function sheetReady(scene: Phaser.Scene, s: PaintedSheet, marks: string[] = []): boolean {
  return [undefined, ...marks].every((m) => {
    const k = sheetKeys(s, m);
    return scene.textures.exists(k.run) && scene.textures.exists(k.jump) && scene.textures.exists(k.slide);
  });
}

/** Adds the sheet's pictures to the scene's loader. Returns false if there was nothing to load. */
export function queueSheet(scene: Phaser.Scene, s: PaintedSheet, marks: string[] = []): boolean {
  let queued = false;
  for (const m of [undefined, ...marks]) {
    const k = sheetKeys(s, m);
    const suffix = m ? `-${m}` : '';
    const { frameWidth, frameHeight } = s.run;
    if (!scene.textures.exists(k.run)) {
      scene.load.spritesheet(k.run, `${s.dir}run${suffix}.webp`, { frameWidth, frameHeight });
      queued = true;
    }
    if (!scene.textures.exists(k.jump)) {
      scene.load.image(k.jump, `${s.dir}jump${suffix}.webp`);
      queued = true;
    }
    if (!scene.textures.exists(k.slide)) {
      scene.load.image(k.slide, `${s.dir}slide${suffix}.webp`);
      queued = true;
    }
  }
  return queued;
}

/** Makes (once) the run animation for a loaded sheet. */
export function makeSheetAnim(scene: Phaser.Scene, s: PaintedSheet): void {
  const k = sheetKeys(s);
  if (scene.anims.exists(k.anim)) return;
  scene.anims.create({
    key: k.anim,
    frames: scene.anims.generateFrameNumbers(k.run, { start: 0, end: s.run.frames - 1 }),
    frameRate: s.run.frameRate,
    repeat: -1,
  });
}

/**
 * The run frames as picture URLs for the cards' little flipbook, tinted and
 * with the marking layers on, the way the pet looks in the game.
 */
export function sheetFrameUrls(scene: Phaser.Scene, s: PaintedSheet, tint: number | undefined, marks: string[]): string[] {
  const k = sheetKeys(s);
  return Array.from({ length: s.run.frames }, (_, i) => {
    if (tint === undefined && !marks.length) return scene.textures.getBase64(k.run, i) as string;
    const f = scene.textures.getFrame(k.run, i);
    const cv = document.createElement('canvas');
    cv.width = f.cutWidth;
    cv.height = f.cutHeight;
    const g = cv.getContext('2d')!;
    const draw = (key: string) => {
      const fr = scene.textures.getFrame(key, i);
      g.drawImage(fr.source.image as CanvasImageSource, fr.cutX, fr.cutY, fr.cutWidth, fr.cutHeight, 0, 0, fr.cutWidth, fr.cutHeight);
    };
    draw(k.run);
    if (tint !== undefined) {
      // multiply the light coat by the color, then keep only the pet's own shape
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = `#${tint.toString(16).padStart(6, '0')}`;
      g.fillRect(0, 0, cv.width, cv.height);
      g.globalCompositeOperation = 'destination-in';
      draw(k.run);
      g.globalCompositeOperation = 'source-over';
    }
    for (const m of marks) draw(sheetKeys(s, m).run);
    return cv.toDataURL();
  });
}
