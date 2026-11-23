import Phaser from 'phaser';

/**
 * Playable breeds, painted in layers (Elon's breed drop, v1; see
 * docs/painted-pets.md). Every layer has the same cells as Chewy's sheets:
 * run 1512x112 (8 cells of 189x112), jump 176x150, slide 198x79, painted at
 * 2x, nose on the right edge and paws on the bottom edge.
 *
 * A dog is drawn as a stack of layers, back to front: the coat's body layers
 * (a tinted light coat or a painted black coat, then marks, then patterns),
 * the chosen ear or tail shape for each body layer, the Lab's optional tail
 * tip and gray muzzle, the bandana, and last the eyes and nose (never tinted).
 * Files: public/art/pets/<breed>/<layer>-<state>.webp.
 */

export type BreedId = 'lab' | 'gsd' | 'collie' | 'doxie' | 'beagle' | 'frenchie';
export type BreedState = 'run' | 'jump' | 'slide';

/** One coat layer: its tint (none for painted black) and see-through amount. */
export interface CoatLayer {
  layer: string;
  tint?: number;
  alpha?: number;
}

/** What the player picked for a breed dog. Saved as-is, so keep it plain data. */
export interface DogChoice {
  breed: BreedId;
  coat: string;
  /** shape option for the breed's ears (Shepherd, Collie), else the default */
  ears?: string;
  /** shape option for the breed's tail (Frenchie), else the default */
  tail?: string;
  /** a bandana color name, or none */
  bandana?: string;
  /** Lab only: white tail tip */
  tailtip?: boolean;
  /** Lab only: gray muzzle */
  muzzle?: boolean;
}

export interface Breed {
  id: BreedId;
  label: string;
  defaultCoat: string;
  /** coat name -> layers, back to front */
  coats: Record<string, { label: string; layers: CoatLayer[] }>;
  /** shape groups ('ears', 'tail'): options, default first */
  variants: Partial<Record<'ears' | 'tail', string[]>>;
  /** optional Lab features */
  features: { tailtip?: boolean; muzzle?: boolean };
}

export const CELL = { frameWidth: 189, frameHeight: 112, frames: 8, frameRate: 16 };
/** Same as Chewy: painted at 2x, a little bigger to match the drawn pets, hit box center 0.66 across. */
export const BREED_RES = 2;
export const BREED_FIT = 1.15;
export const BREED_ORIGIN_X = 0.66;

const DARK = 0x4a4548;
const L = (layer: string, tint?: number, alpha?: number): CoatLayer => ({ layer, tint, alpha });

export const BREEDS: Breed[] = [
  {
    id: 'lab',
    label: 'Lab',
    defaultCoat: 'yellow',
    coats: {
      yellow: { label: 'Yellow', layers: [L('coat', 0xffd192)] },
      black: { label: 'Black', layers: [L('coat-black')] },
      chocolate: { label: 'Chocolate', layers: [L('coat', 0x7e5034)] },
    },
    variants: {},
    features: { tailtip: true, muzzle: true },
  },
  {
    id: 'gsd',
    label: 'Shepherd',
    defaultCoat: 'black-and-tan',
    coats: {
      'black-and-tan': { label: 'Black and tan', layers: [L('coat', 0xc98a4b), L('mark-saddle', DARK)] },
      sable: { label: 'Sable', layers: [L('coat', 0xc29560), L('mark-saddle-light', 0x5e4a38, 0.9)] },
      black: { label: 'Black', layers: [L('coat-black')] },
    },
    variants: { ears: ['up', 'soft'] },
    features: {},
  },
  {
    id: 'collie',
    label: 'Collie',
    defaultCoat: 'black-white',
    coats: {
      'black-white': { label: 'Black and white', layers: [L('coat', 0xf6efe6), L('mark-black', DARK)] },
      'red-white': { label: 'Red and white', layers: [L('coat', 0xf6efe6), L('mark-black', 0xd99a63)] },
      'blue-merle': { label: 'Blue merle', layers: [L('coat', 0xf3efea), L('mark-black-light', 0x9ca3ae), L('mark-merle', DARK)] },
    },
    variants: { ears: ['tipped', 'prick', 'drop'] },
    features: {},
  },
  {
    id: 'doxie',
    label: 'Dachshund',
    defaultCoat: 'red',
    coats: {
      red: { label: 'Red', layers: [L('coat', 0xc8692a)] },
      'black-and-tan': { label: 'Black and tan', layers: [L('coat', 0xc67a35), L('mark-blacktan', DARK)] },
      dapple: { label: 'Dapple', layers: [L('coat', 0xc67a35), L('mark-blacktan', DARK), L('mark-dapple', 0xbfb3a2, 0.8)] },
    },
    variants: {},
    features: {},
  },
  {
    id: 'beagle',
    label: 'Beagle',
    defaultCoat: 'tricolor',
    coats: {
      tricolor: { label: 'Tricolor', layers: [L('coat', 0xf6eee4), L('mark-tan', 0xe0914d), L('mark-black', DARK)] },
      lemon: { label: 'Lemon', layers: [L('coat-light', 0xfff8ec), L('mark-tan-light', 0xf3d08a), L('mark-black-light', 0xefcb7e)] },
    },
    variants: {},
    features: {},
  },
  {
    id: 'frenchie',
    label: 'Frenchie',
    defaultCoat: 'fawn',
    coats: {
      fawn: { label: 'Fawn', layers: [L('coat', 0xe8b67e), L('mark-mask', 0x5a4636)] },
      brindle: { label: 'Brindle', layers: [L('coat', 0xa27850), L('mark-brindle', 0x3b2a1e, 0.92), L('mark-mask', 0x33261f)] },
      cream: { label: 'Cream', layers: [L('coat', 0xffdfae), L('mark-mask-light', 0xb0906f)] },
    },
    variants: { tail: ['stub', 'screw'] },
    features: {},
  },
];

export const BANDANAS: Record<string, number> = {
  red: 0xc8362e,
  blue: 0x2f6fb5,
  green: 0x3e8e4e,
  yellow: 0xe3b23c,
  purple: 0x7a4fa8,
  pink: 0xe07aa6,
};

const FEATURE_TINT = { tailtip: 0xf4efe6, muzzle: 0xd9d3ca };
/** Swatch for painted black coats on the coat chips. */
const BLACK_SWATCH = 0x2b2724;

export function breedById(id: string | undefined): Breed | undefined {
  return id ? BREEDS.find((b) => b.id === id) : undefined;
}

/** A saved choice that still matches the breed list, or undefined (a bad save falls back to Chewy). */
export function validDog(raw: unknown): DogChoice | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const b = breedById(typeof r.breed === 'string' ? r.breed : undefined);
  if (!b || typeof r.coat !== 'string' || !(r.coat in b.coats)) return undefined;
  const d: DogChoice = { breed: b.id, coat: r.coat };
  for (const g of ['ears', 'tail'] as const) {
    if (r[g] === undefined) continue;
    if (typeof r[g] !== 'string' || !b.variants[g]?.includes(r[g] as string)) return undefined;
    d[g] = r[g] as string;
  }
  if (r.bandana !== undefined) {
    if (typeof r.bandana !== 'string' || !(r.bandana in BANDANAS)) return undefined;
    d.bandana = r.bandana;
  }
  if (r.tailtip === true && b.features.tailtip) d.tailtip = true;
  if (r.muzzle === true && b.features.muzzle) d.muzzle = true;
  return d;
}

/** The shape layer that goes with a body layer: ears-prick, ears-prick-black, ears-prick-mark-black ... */
function shapeName(group: string, opt: string, body: string): string {
  if (body === 'coat') return `${group}-${opt}`;
  if (body === 'coat-black') return `${group}-${opt}-black`;
  if (body === 'coat-light') return `${group}-${opt}-light`;
  return `${group}-${opt}-${body}`;
}

/** The option of a shape group this dog shows (the breed default when none is picked). */
export function shapeOption(c: DogChoice, group: 'ears' | 'tail'): string | undefined {
  const opts = breedById(c.breed)?.variants[group];
  if (!opts) return undefined;
  const pick = c[group];
  return pick && opts.includes(pick) ? pick : opts[0];
}

/** Layers back to front, with tints. layers[0] is the base, the one that animates. */
export function layersFor(c: DogChoice): CoatLayer[] {
  const b = breedById(c.breed)!;
  const body = (b.coats[c.coat] ?? b.coats[b.defaultCoat]).layers;
  const out = [...body];
  for (const group of ['ears', 'tail'] as const) {
    const opt = shapeOption(c, group);
    if (opt) for (const l of body) out.push({ ...l, layer: shapeName(group, opt, l.layer) });
  }
  if (c.tailtip && b.features.tailtip) out.push(L('mark-tailtip', FEATURE_TINT.tailtip));
  if (c.muzzle && b.features.muzzle) out.push(L('mark-muzzle', FEATURE_TINT.muzzle));
  if (c.bandana && BANDANAS[c.bandana] !== undefined) out.push(L('acc-bandana', BANDANAS[c.bandana]));
  out.push(L('detail'));
  return out;
}

export function breedKey(b: BreedId, layer: string, st: BreedState): string {
  return `pet-${b}-${layer}-${st}`;
}

export function breedDir(b: BreedId): string {
  return `art/pets/${b}/`;
}

/** The chip color for a coat. */
export function coatSwatch(b: Breed, coat: string): number {
  return b.coats[coat]?.layers[0].tint ?? BLACK_SWATCH;
}

/** True once every layer this dog draws is loaded. */
export function breedReady(scene: Phaser.Scene, c: DogChoice): boolean {
  return layersFor(c).every((l) => (['run', 'jump', 'slide'] as const).every((st) => scene.textures.exists(breedKey(c.breed, l.layer, st))));
}

/** Queues only the sheets this dog draws. Returns true if anything was queued. */
export function queueBreed(scene: Phaser.Scene, c: DogChoice): boolean {
  let queued = false;
  for (const { layer } of layersFor(c)) {
    for (const st of ['run', 'jump', 'slide'] as const) {
      const k = breedKey(c.breed, layer, st);
      if (scene.textures.exists(k)) continue;
      const url = `${breedDir(c.breed)}${layer}-${st}.webp`;
      if (st === 'run') scene.load.spritesheet(k, url, { frameWidth: CELL.frameWidth, frameHeight: CELL.frameHeight });
      else scene.load.image(k, url);
      queued = true;
    }
  }
  return queued;
}

/** Makes (once) the run animation on the base layer's sheet. Returns its key. */
export function makeBreedAnim(scene: Phaser.Scene, c: DogChoice): string {
  const k = breedKey(c.breed, layersFor(c)[0].layer, 'run');
  if (!scene.anims.exists(k)) {
    scene.anims.create({ key: k, frames: scene.anims.generateFrameNumbers(k, { start: 0, end: CELL.frames - 1 }), frameRate: CELL.frameRate, repeat: -1 });
  }
  return k;
}

/** A short id for a dog's look, for caching its card flipbook. */
export function dogKey(c: DogChoice): string {
  return layersFor(c)
    .map((l) => `${l.layer}:${l.tint ?? ''}:${l.alpha ?? ''}`)
    .join(',');
}

/** The run frames as picture URLs for the cards' flipbook: every layer, tinted, stacked. */
export function breedFrameUrls(scene: Phaser.Scene, c: DogChoice): string[] {
  const layers = layersFor(c);
  const tmp = document.createElement('canvas');
  return Array.from({ length: CELL.frames }, (_, i) => {
    const cv = document.createElement('canvas');
    cv.width = CELL.frameWidth;
    cv.height = CELL.frameHeight;
    const g = cv.getContext('2d')!;
    for (const l of layers) {
      const fr = scene.textures.getFrame(breedKey(c.breed, l.layer, 'run'), i);
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
