import Phaser from 'phaser';

/**
 * Painted pictures that replace code-painted textures, one file per texture
 * key: props (treats and the things on the trail) in public/art/props/ and
 * critters (and the dens) in public/art/critters/. Each is painted at twice
 * the size the code paints that key (a 24x14 bone is 48x28), centered, with
 * things that stand on the ground sitting on the bottom edge.
 *
 * A key listed here is loaded from its file, and the code-painted version is
 * made only if the file fails to load. A key not listed is painted in code.
 */
const PROPS = [
  'arch', 'arch-leg', 'autumnbranch', 'awning', 'ball', 'banner', 'barrel', 'blossombranch',
  'bone', 'branch', 'cactus', 'canopy', 'canopy-autumn', 'canopy-blossom', 'canopy-jungle',
  'clothesline', 'crate', 'creek', 'driftwood', 'fence', 'fence-rail', 'fish', 'haybale', 'hydrant', 'lantern',
  'log', 'pier-pole', 'pond', 'puddle', 'pumpkin', 'rock', 'sandcastle', 'sign', 'sled',
  'snowbranch', 'snowcanopy', 'snowman', 'stump', 'trashcan', 'trough', 'trunk', 'tumbleweed',
  'umbrella', 'umbrella-pole', 'vines', 'wood-post',
];
/** Two-frame critters: -0 is wings up (or the arm up), -1 is down. */
const FLAPPERS = ['balloon', 'bird', 'butterfly', 'cardinal', 'crow', 'duck', 'gull', 'hawk', 'owl', 'parrot', 'person', 'pigeon'];
const CRITTERS = [
  ...FLAPPERS.flatMap((k) => [`${k}-0`, `${k}-1`]),
  'chicken', 'chipmunk', 'crab', 'fox', 'frog', 'gopher', 'lizard', 'monkey', 'mouse', 'rabbit',
  'squirrel', 'streetcat', 'streetdog',
  ...['dirt', 'sand', 'snow'].flatMap((e) => [`den-${e}`, `den-${e}-lip`]),
];
/**
 * Backyard Toss pictures in public/art/bonus/ (the keys are listed at the top
 * of src/scenes/BonusScene.ts). Add a key here once its picture is in.
 */
const BONUS_ART: string[] = [];
const FILES = new Map<string, string>([
  ...PROPS.map((k): [string, string] => [k, 'props']),
  ...CRITTERS.map((k): [string, string] => [k, 'critters']),
  ...BONUS_ART.map((k): [string, string] => [k, 'bonus']),
]);

/** Picture pixels per game pixel in a painted file. */
const FILE_RES = 2;

const failed = new Set<string>();
const onError = (file: Phaser.Loader.File): void => {
  if (FILES.has(file.key)) failed.add(file.key);
};

/** True when a key's picture comes from its file, so the code shouldn't paint it. */
export function artFromFile(key: string): boolean {
  return FILES.has(key) && !failed.has(key);
}

/** Queues the files for these keys (the ones not loaded yet). Call from preload. */
export function queueArt(scene: Phaser.Scene, keys: Iterable<string>): void {
  scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
  for (const key of new Set(keys)) {
    if (artFromFile(key) && !scene.textures.exists(key)) scene.load.image(key, `art/${FILES.get(key)}/${key}.webp`);
  }
}

/**
 * Marks the loaded pictures as 2x, so art() and artScale() show them at
 * their size in the game. Call from create, before anything uses them.
 */
export function markArt(scene: Phaser.Scene): void {
  // a flap is painted in code as a pair if either picture failed, so both frames match
  for (const k of FLAPPERS) {
    const pair = [`${k}-0`, `${k}-1`];
    if (!pair.some((p) => failed.has(p))) continue;
    for (const p of pair) {
      failed.add(p);
      if (scene.textures.exists(p) && scene.textures.get(p).getSourceImage() instanceof HTMLImageElement) scene.textures.remove(p);
    }
  }
  for (const key of FILES.keys()) {
    if (!artFromFile(key) || !scene.textures.exists(key)) continue;
    (scene.textures.get(key).customData as { res?: number }).res = FILE_RES;
  }
}

export interface ArtBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The part of a texture that's actually painted, in texture pixels. A painted
 * prop can sit in clear space (the fence fills only the lower part of its
 * picture), so hit areas and shadows are measured from this. Code-painted
 * textures fill their picture, so for them it's the whole texture.
 */
export function artBox(scene: Phaser.Scene, key: string): ArtBox {
  const tex = scene.textures.get(key);
  const data = tex.customData as { res?: number; box?: ArtBox };
  if (data.box) return data.box;
  const src = tex.getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  let box: ArtBox = { x: 0, y: 0, w: src.width, h: src.height };
  if (artFromFile(key) && src instanceof HTMLImageElement) box = measure(src) ?? box;
  data.box = box;
  return box;
}

/** The bounds of the pixels that are at least a quarter opaque. */
function measure(img: HTMLImageElement): ArtBox | undefined {
  const cv = document.createElement('canvas');
  cv.width = img.width;
  cv.height = img.height;
  const g = cv.getContext('2d', { willReadFrequently: true });
  if (!g) return undefined;
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, cv.width, cv.height).data;
  let x0 = cv.width;
  let y0 = cv.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x++) {
      if (px[(y * cv.width + x) * 4 + 3] < 64) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  return x1 < 0 ? undefined : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
