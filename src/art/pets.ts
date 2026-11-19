import Phaser from 'phaser';

/**
 * Pet art, drawn in code for each species and fur color. Each pet gets
 * three run frames plus a jump and a slide pose. Later the in-game pet
 * stays a drawn character like this (matched to the player's breed),
 * while the AI portrait goes on the start and end cards.
 */

export type Species = 'dog' | 'cat';
export type Size = 'small' | 'medium' | 'large';

export interface Palette {
  label: string;
  fur: number;
  dark: number;
  light: number;
}

export const PALETTES: Record<string, Palette> = {
  brown: { label: 'Brown', fur: 0xb07040, dark: 0x7a4a26, light: 0xe8c39a },
  golden: { label: 'Golden', fur: 0xd9a441, dark: 0xa8762a, light: 0xf6dfa8 },
  black: { label: 'Black', fur: 0x3a3330, dark: 0x1f1a18, light: 0xc58b54 },
  white: { label: 'White', fur: 0xf2ece2, dark: 0xc9bfae, light: 0xffffff },
  grey: { label: 'Grey', fur: 0x9a9ea6, dark: 0x6b6f77, light: 0xd9dce0 },
};

export const SIZE_SCALE: Record<Size, number> = { small: 0.8, medium: 1, large: 1.2 };

export interface PetChoice {
  species: Species;
  size: Size;
  palette: keyof typeof PALETTES;
}

export const DEFAULT_PET: PetChoice = { species: 'dog', size: 'medium', palette: 'brown' };

const NOSE = 0x2b1a0d;
const COLLAR = 0xd6402b;

type G = Phaser.GameObjects.Graphics;
type Feet = { bf: [number, number]; bn: [number, number]; ff: [number, number]; fn: [number, number] };

const RUN_FEET: Feet[] = [
  { bf: [12, 53], bn: [6, 53], ff: [48, 53], fn: [56, 53] },
  { bf: [16, 53], bn: [14, 53], ff: [42, 53], fn: [46, 53] },
  { bf: [22, 53], bn: [24, 53], ff: [36, 53], fn: [34, 53] },
];
const JUMP_FEET: Feet = { bf: [6, 42], bn: [2, 44], ff: [58, 40], fn: [62, 42] };

/** Texture key prefix for a pet, e.g. "cat-grey". */
export function petKey(c: PetChoice): string {
  return `${c.species}-${c.palette}`;
}

function leg(g: G, x1: number, y1: number, x2: number, y2: number, color: number, w: number): void {
  g.lineStyle(w, color, 1);
  g.lineBetween(x1, y1, x2, y2);
  g.fillStyle(color, 1);
  g.fillCircle(x2, y2 - 1, w * 0.6);
}

function outline(p: Palette): number {
  // Light coats need a soft outline so they don't vanish against the sky
  return p.fur === PALETTES.white.fur ? 0xb5aa98 : p.dark;
}

function drawDog(g: G, p: Palette, f: Feet): void {
  leg(g, 18, 34, f.bf[0], f.bf[1], p.dark, 6);
  leg(g, 42, 34, f.ff[0], f.ff[1], p.dark, 6);
  g.lineStyle(5, p.dark, 1);
  g.beginPath();
  g.moveTo(10, 26);
  g.lineTo(4, 18);
  g.lineTo(6, 10);
  g.strokePath();
  g.fillStyle(p.fur, 1);
  g.lineStyle(1.5, outline(p), 1);
  g.fillEllipse(29, 30, 42, 22);
  g.strokeEllipse(29, 30, 42, 22);
  g.fillStyle(p.light, 1);
  g.fillEllipse(34, 35, 22, 10);
  leg(g, 16, 36, f.bn[0], f.bn[1], p.fur, 6);
  leg(g, 40, 36, f.fn[0], f.fn[1], p.fur, 6);
  g.fillStyle(COLLAR, 1);
  g.fillRect(41, 20, 6, 12);
  g.fillStyle(p.fur, 1);
  g.fillCircle(49, 17, 12);
  g.strokeCircle(49, 17, 12);
  g.fillStyle(p.light, 1);
  g.fillEllipse(58, 21, 13, 10);
  g.fillStyle(NOSE, 1);
  g.fillCircle(63, 18.5, 3);
  g.fillStyle(p.dark, 1);
  g.fillEllipse(43, 15, 9, 17);
  eye(g, 52, 13, 0x1a1a1a);
}

function drawCat(g: G, p: Palette, f: Feet): void {
  leg(g, 18, 36, f.bf[0], f.bf[1], p.dark, 5);
  leg(g, 42, 36, f.ff[0], f.ff[1], p.dark, 5);
  // long tail curling up
  g.lineStyle(5, p.dark, 1);
  g.beginPath();
  g.moveTo(10, 30);
  g.lineTo(4, 22);
  g.lineTo(3, 12);
  g.lineTo(7, 5);
  g.strokePath();
  g.fillStyle(p.fur, 1);
  g.lineStyle(1.5, outline(p), 1);
  g.fillEllipse(29, 32, 40, 18);
  g.strokeEllipse(29, 32, 40, 18);
  g.fillStyle(p.light, 1);
  g.fillEllipse(34, 36, 18, 8);
  leg(g, 16, 38, f.bn[0], f.bn[1], p.fur, 5);
  leg(g, 40, 38, f.fn[0], f.fn[1], p.fur, 5);
  // head with pointed ears
  g.fillStyle(p.fur, 1);
  g.fillTriangle(41, 15, 44, 2, 50, 11);
  g.fillTriangle(50, 10, 56, 1, 58, 14);
  g.fillCircle(50, 20, 11);
  g.lineStyle(1.5, outline(p), 1);
  g.strokeCircle(50, 20, 11);
  g.fillStyle(0xf2a0a8, 1);
  g.fillTriangle(44, 12, 45, 5, 48, 11);
  g.fillTriangle(52, 10, 55, 4, 56, 12);
  g.fillStyle(p.light, 1);
  g.fillEllipse(57, 24, 9, 7);
  g.fillStyle(0xe07a8a, 1);
  g.fillTriangle(59, 21, 63, 21, 61, 24);
  eye(g, 53, 17, 0x3c8a3c);
  // whiskers
  g.lineStyle(1, 0x333333, 0.7);
  g.lineBetween(58, 25, 64, 23);
  g.lineBetween(58, 26, 64, 27);
}

function eye(g: G, x: number, y: number, iris: number): void {
  g.fillStyle(iris, 1);
  g.fillCircle(x, y, 2.4);
  g.fillStyle(0x111111, 1);
  g.fillCircle(x + 0.3, y, 1.2);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(x + 0.8, y - 0.8, 0.8);
}

function drawSlide(g: G, species: Species, p: Palette): void {
  g.lineStyle(5, p.dark, 1);
  g.lineBetween(8, 16, 0, species === 'cat' ? 4 : 10);
  g.fillStyle(p.fur, 1);
  g.lineStyle(1.5, outline(p), 1);
  g.fillEllipse(30, 19, 46, 15);
  g.strokeEllipse(30, 19, 46, 15);
  leg(g, 14, 22, 2, 27, p.fur, 5);
  leg(g, 42, 22, 60, 27, p.fur, 5);
  if (species === 'dog') {
    g.fillStyle(COLLAR, 1);
    g.fillRect(44, 12, 5, 10);
  }
  g.fillStyle(p.fur, 1);
  if (species === 'cat') {
    g.fillTriangle(48, 10, 50, 1, 55, 8);
    g.fillTriangle(55, 7, 60, 0, 61, 9);
  }
  g.fillCircle(54, 14, 10);
  g.lineStyle(1.5, outline(p), 1);
  g.strokeCircle(54, 14, 10);
  g.fillStyle(p.light, 1);
  g.fillEllipse(62, 17, 11, 8);
  g.fillStyle(species === 'cat' ? 0xe07a8a : NOSE, 1);
  g.fillCircle(67, 15.5, species === 'cat' ? 1.8 : 2.5);
  if (species === 'dog') {
    g.fillStyle(p.dark, 1);
    g.fillEllipse(48, 9, 14, 7);
  }
  eye(g, 57, 11, species === 'cat' ? 0x3c8a3c : 0x1a1a1a);
}

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Makes (once) the textures and run animation for one species and color. */
export function makePetTextures(scene: Phaser.Scene, c: PetChoice): void {
  const key = petKey(c);
  const p = PALETTES[c.palette];
  const body = c.species === 'cat' ? drawCat : drawDog;
  RUN_FEET.forEach((f, i) => make(scene, `${key}-run-${i}`, 64, 56, (g) => body(g, p, f)));
  make(scene, `${key}-jump`, 64, 56, (g) => body(g, p, JUMP_FEET));
  make(scene, `${key}-slide`, 70, 30, (g) => drawSlide(g, c.species, p));
  if (!scene.anims.exists(`${key}-run`)) {
    scene.anims.create({
      key: `${key}-run`,
      frames: [0, 1, 2, 1].map((i) => ({ key: `${key}-run-${i}` })),
      frameRate: 12,
      repeat: -1,
    });
  }
}

const STORE_KEY = 'fetch-dash-pet';

export function loadPet(): PetChoice {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (raw && (raw.species === 'dog' || raw.species === 'cat') && raw.size in SIZE_SCALE && raw.palette in PALETTES) {
      return raw as PetChoice;
    }
  } catch {
    // fall through to the default
  }
  return { ...DEFAULT_PET };
}

export function savePet(c: PetChoice): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(c));
  } catch {
    // Storage can be blocked (private mode); the choice just won't be remembered.
  }
}
