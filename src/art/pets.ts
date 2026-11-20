import Phaser from 'phaser';
import { circle, css, ellipse, fillOut, grain, lin, line, paint, rad, roundX, roundY, shade, type Ctx } from './paint';

/**
 * Pet art, painted in code for each species and fur color (see paint.ts).
 * Each pet gets three run frames plus a jump and a slide pose. Later the in-game pet
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
  ginger: { label: 'Ginger', fur: 0xd9782f, dark: 0xa4541c, light: 0xf6c99a },
  cream: { label: 'Cream', fur: 0xe9d2a8, dark: 0xbfa477, light: 0xfff6e4 },
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

function outline(p: Palette): number {
  // Light coats need a soft outline so they don't vanish against the sky
  return p.fur === PALETTES.white.fur || p.fur === PALETTES.cream.fur ? 0xa89c88 : shade(p.dark, -0.35);
}

/**
 * A leg from hip to paw, with a slight bend, an outline and a lit front edge.
 * Near legs (drawn over the body) start with a soft thigh and no outline at
 * the top, so they grow out of the body instead of sitting on it.
 */
function leg(c: Ctx, p: Palette, x1: number, y1: number, x2: number, y2: number, color: number, w: number, back: boolean, near = false): void {
  const cx = (x1 + x2) / 2 + (back ? -2.5 : 1.5);
  const cy = (y1 + y2) / 2;
  const path = (from = 0) => {
    const t = from;
    c.beginPath();
    c.moveTo(x1 + (cx - x1) * t, y1 + (cy - y1) * t);
    c.quadraticCurveTo(cx, cy, x2, y2 - 1.5);
  };
  path(near ? 0.45 : 0);
  c.strokeStyle = css(outline(p));
  c.lineWidth = w + 2.2;
  c.stroke();
  if (near) {
    ellipse(c, x1 + (back ? -1 : 1), y1 + 1, w * 0.95, w * 1.15);
    c.fillStyle = rad(c, x1 - 1, y1 - 1, 0.5, x1, y1 + 1, w * 1.2, [[0, shade(color, 0.12)], [0.7, color], [1, color, 0]]);
    c.fill();
  }
  path();
  c.strokeStyle = css(color);
  c.lineWidth = w;
  c.stroke();
  c.save();
  c.translate(-w * 0.22, 0);
  path(near ? 0.3 : 0);
  c.strokeStyle = css(shade(color, 0.22), 0.7);
  c.lineWidth = w * 0.3;
  c.stroke();
  c.restore();
  // paw, kept inside the picture
  const rx = w * 0.68;
  const px = Math.max(rx + 0.6, Math.min(x2 + 0.8, 63.4 - rx));
  ellipse(c, px, y2 - 1, rx, w * 0.46);
  fillOut(c, roundY(c, y2 - 1 - w * 0.46, y2 - 1 + w * 0.46, color, 0.25, -0.3), outline(p), 1);
}

/** Shades a body shape: lit from the upper left, with a soft pale belly. */
function shadeBody(c: Ctx, p: Palette, path: () => void, lx: number, ly: number, belly: [number, number, number, number]): void {
  path();
  fillOut(c, rad(c, lx, ly, 2, lx + 6, ly + 7, 28, [[0, shade(p.fur, 0.3)], [0.5, p.fur], [1, shade(p.fur, -0.3)]]), outline(p), 1.4);
  c.save();
  path();
  c.clip();
  const [bx, by, brx, bry] = belly;
  ellipse(c, bx, by, brx, bry);
  c.fillStyle = rad(c, bx, by + 1, 1, bx, by, brx, [[0, p.light, 0.95], [0.65, p.light, 0.6], [1, p.light, 0]]);
  c.fill();
  c.restore();
}

/** A few fur strokes along a coat, lighter on top and darker underneath. */
function fur(c: Ctx, p: Palette, strokes: [number, number, number, number][]): void {
  for (const [x, y, dx, dy] of strokes) {
    const top = y < 30;
    line(c, [[x, y], [x + dx, y + dy]], top ? shade(p.fur, 0.35) : shade(p.fur, -0.3), 1, top ? 0.55 : 0.45);
  }
}

function eye(c: Ctx, x: number, y: number, iris: number, cat: boolean): void {
  if (cat) {
    ellipse(c, x, y, 2.7, 2.3);
    fillOut(c, rad(c, x - 0.6, y - 0.6, 0.2, x, y, 2.7, [[0, shade(iris, 0.45)], [1, iris]]), 0x1a1a1a, 0.8);
    ellipse(c, x + 0.4, y, 0.7, 2);
  } else {
    circle(c, x, y, 2.5);
    fillOut(c, rad(c, x - 0.6, y - 0.8, 0.2, x, y, 2.5, [[0, 0x5a3a24], [1, 0x140c08]]), 0x0a0605, 0.6);
    circle(c, x + 0.3, y + 0.2, 1.2);
  }
  c.fillStyle = css(0x0c0c0c);
  c.fill();
  circle(c, x + 0.9, y - 0.9, 0.85);
  c.fillStyle = css(0xffffff);
  c.fill();
  circle(c, x - 0.8, y + 0.9, 0.4);
  c.fillStyle = css(0xffffff, 0.7);
  c.fill();
}

function nose(c: Ctx, x: number, y: number, r: number, color: number): void {
  ellipse(c, x, y, r, r * 0.78);
  c.fillStyle = rad(c, x - r * 0.3, y - r * 0.4, 0.2, x, y, r, [[0, shade(color, 0.45)], [1, color]]);
  c.fill();
  ellipse(c, x - r * 0.3, y - r * 0.35, r * 0.35, r * 0.2);
  c.fillStyle = css(0xffffff, 0.6);
  c.fill();
}

function collar(c: Ctx, x: number, y: number, h: number): void {
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + 3.5, y - 1, x + 6.5, y + 0.5);
  c.lineTo(x + 6, y + h);
  c.quadraticCurveTo(x + 3, y + h + 1.2, x - 0.5, y + h - 0.5);
  c.closePath();
  fillOut(c, roundX(c, x, x + 6.5, COLLAR, 0.3, -0.35), 0x7a1e12, 0.9);
  circle(c, x + 3.5, y + h + 2.2, 2);
  fillOut(c, rad(c, x + 2.8, y + h + 1.5, 0.2, x + 3.5, y + h + 2.2, 2, [[0, 0xfff0a0], [1, 0xc89a2a]]), 0x7a5a10, 0.7);
}

function drawDog(c: Ctx, p: Palette, f: Feet): void {
  leg(c, p, 18, 34, f.bf[0], f.bf[1], p.dark, 6, true);
  leg(c, p, 42, 34, f.ff[0], f.ff[1], p.dark, 6, false);
  // tail, wagging up behind
  const tail = () => {
    c.beginPath();
    c.moveTo(11, 27);
    c.quadraticCurveTo(3, 21, 5, 9);
  };
  tail();
  c.strokeStyle = css(outline(p));
  c.lineWidth = 6.6;
  c.stroke();
  tail();
  c.strokeStyle = lin(c, 11, 27, 5, 9, [[0, p.fur], [1, p.dark]]);
  c.lineWidth = 4.6;
  c.stroke();
  const body = () => {
    c.beginPath();
    c.moveTo(12, 23.5);
    c.bezierCurveTo(18, 17.5, 36, 17, 44, 19.5);
    c.bezierCurveTo(52, 22.5, 52.5, 36, 46.5, 39.5);
    c.bezierCurveTo(38.5, 42.5, 30, 39.5, 22, 40.5);
    c.bezierCurveTo(12, 41.5, 6.5, 36, 7.5, 30);
    c.bezierCurveTo(8, 27, 9.5, 25, 12, 23.5);
    c.closePath();
  };
  shadeBody(c, p, body, 22, 21, [35, 37, 12, 5]);
  fur(c, p, [[16, 22, 3, -0.8], [24, 20, 3, -0.5], [32, 19.6, 3, -0.2], [20, 39.5, 2.5, 0.8], [28, 39.2, 2.5, 0.8], [10, 33, -0.8, 2.5]]);
  leg(c, p, 16, 36, f.bn[0], f.bn[1], p.fur, 6, true, true);
  leg(c, p, 40, 36, f.fn[0], f.fn[1], p.fur, 6, false, true);
  collar(c, 41.5, 20, 11.5);
  // head: skull, muzzle, ear, eye, nose, a happy tongue
  circle(c, 49, 16.5, 11.5);
  fillOut(c, rad(c, 45, 11, 1, 49, 16.5, 13, [[0, shade(p.fur, 0.32)], [0.55, p.fur], [1, shade(p.fur, -0.28)]]), outline(p), 1.4);
  c.beginPath();
  c.moveTo(57, 25.5);
  c.quadraticCurveTo(58.5, 31, 61.5, 29.5);
  c.quadraticCurveTo(62.5, 26.5, 60.5, 24.5);
  c.closePath();
  fillOut(c, lin(c, 0, 24, 0, 31, [[0, 0xf08a96], [1, 0xc8505e]]), 0x8a2a36, 0.8);
  ellipse(c, 57.5, 21, 7.6, 5.4);
  fillOut(c, rad(c, 56, 18.5, 0.5, 57.5, 21, 8, [[0, shade(p.light, 0.25)], [0.7, p.light], [1, shade(p.light, -0.18)]]), outline(p), 1.1);
  line(c, [[62, 23.2], [59.5, 24.6], [56.5, 24.2]], 0x3a2418, 0.9, 0.8);
  nose(c, 63.2, 18.6, 3, NOSE);
  c.beginPath();
  c.moveTo(45.5, 7.5);
  c.bezierCurveTo(38.5, 8.5, 37.5, 19, 40.5, 24.5);
  c.quadraticCurveTo(43.5, 25.5, 46.5, 21);
  c.quadraticCurveTo(48.5, 13, 45.5, 7.5);
  c.closePath();
  fillOut(c, lin(c, 38, 8, 47, 24, [[0, shade(p.dark, 0.2)], [1, shade(p.dark, -0.3)]]), outline(p), 1.1);
  eye(c, 52.5, 13, 0x1a1a1a, false);
  line(c, [[50, 9.2], [53.5, 8.8]], shade(p.fur, -0.35), 1, 0.6);
}

function drawCat(c: Ctx, p: Palette, f: Feet): void {
  leg(c, p, 18, 36, f.bf[0], f.bf[1], p.dark, 5, true);
  leg(c, p, 42, 36, f.ff[0], f.ff[1], p.dark, 5, false);
  // long tail curling up
  const tail = () => {
    c.beginPath();
    c.moveTo(11, 31);
    c.bezierCurveTo(2, 26, 1, 14, 4, 8);
    c.quadraticCurveTo(6, 4, 9, 5);
  };
  tail();
  c.strokeStyle = css(outline(p));
  c.lineWidth = 6.4;
  c.stroke();
  tail();
  c.strokeStyle = lin(c, 11, 31, 6, 4, [[0, p.fur], [1, p.dark]]);
  c.lineWidth = 4.4;
  c.stroke();
  const body = () => {
    c.beginPath();
    c.moveTo(12, 26);
    c.bezierCurveTo(20, 21.5, 36, 21.5, 44, 23.5);
    c.bezierCurveTo(50.5, 25.5, 51, 37, 45.5, 39.5);
    c.bezierCurveTo(37, 41.5, 28, 39.5, 21, 40.5);
    c.bezierCurveTo(12, 41.5, 8, 37, 8.5, 32);
    c.bezierCurveTo(9, 29, 10, 27, 12, 26);
    c.closePath();
  };
  shadeBody(c, p, body, 22, 24, [35, 37.5, 10, 4.2]);
  fur(c, p, [[17, 24.5, 3, -0.5], [25, 23, 3, -0.3], [33, 22.8, 3, 0], [20, 39.8, 2.5, 0.6], [29, 39.4, 2.5, 0.6]]);
  leg(c, p, 16, 38, f.bn[0], f.bn[1], p.fur, 5, true, true);
  leg(c, p, 40, 38, f.fn[0], f.fn[1], p.fur, 5, false, true);
  // ears, then the head over them
  for (const [a, b, d] of [[[40.5, 15], [44, 1.5], [50.5, 10.5]], [[49.5, 10], [56.5, 0.8], [58.5, 14.5]]] as [number, number][][]) {
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.quadraticCurveTo(b[0] - 1, b[1] + 2, b[0], b[1]);
    c.quadraticCurveTo(b[0] + 1.5, b[1] + 3, d[0], d[1]);
    c.closePath();
    fillOut(c, lin(c, 0, b[1], 0, a[1], [[0, shade(p.fur, -0.1)], [1, p.fur]]), outline(p), 1.2);
  }
  for (const pts of [[[44, 12], [44.8, 5], [48, 11]], [[52, 10], [55.4, 4], [56.3, 12]]] as [number, number][][]) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = lin(c, 0, 4, 0, 12, [[0, 0xf7b8c0], [1, 0xe08a98]]);
    c.fill();
  }
  circle(c, 50, 20, 11);
  fillOut(c, rad(c, 46, 15, 1, 50, 20, 12.5, [[0, shade(p.fur, 0.32)], [0.55, p.fur], [1, shade(p.fur, -0.28)]]), outline(p), 1.4);
  ellipse(c, 57, 24, 5, 3.8);
  c.fillStyle = rad(c, 56.5, 23, 0.5, 57, 24, 5.5, [[0, shade(p.light, 0.2)], [0.75, p.light], [1, p.light, 0.3]]);
  c.fill();
  c.beginPath();
  c.moveTo(59.2, 21);
  c.lineTo(62.8, 21);
  c.lineTo(61, 23.6);
  c.closePath();
  c.fillStyle = lin(c, 0, 21, 0, 23.6, [[0, 0xf2a0ae], [1, 0xc86a7a]]);
  c.fill();
  line(c, [[61, 23.6], [61, 25], [59.5, 26]], 0x5a3a3a, 0.8, 0.7);
  line(c, [[61, 25], [62.5, 26]], 0x5a3a3a, 0.8, 0.7);
  eye(c, 53, 17, 0x4caa4c, true);
  for (const [x2, y2] of [[66, 22.5], [66.5, 26], [65.5, 29]]) line(c, [[58.5, 25.5], [x2, y2]], 0xffffff, 0.7, 0.75);
}

function drawSlide(c: Ctx, species: Species, p: Palette): void {
  const cat = species === 'cat';
  // tail streaming out behind
  line(c, [[9, 16], [3, cat ? 7 : 11], [0.5, cat ? 3 : 9]], outline(p), 6.2);
  line(c, [[9, 16], [3, cat ? 7 : 11], [0.5, cat ? 3 : 9]], p.dark, 4.2);
  leg(c, p, 14, 22, 2, 27, p.dark, 5, true);
  ellipse(c, 30, 19, 23, 7.6);
  fillOut(c, rad(c, 24, 14, 1, 30, 18, 24, [[0, shade(p.fur, 0.3)], [0.55, p.fur], [1, shade(p.fur, -0.3)]]), outline(p), 1.4);
  ellipse(c, 33, 23.5, 12, 3);
  c.fillStyle = rad(c, 33, 24, 1, 33, 23.5, 12, [[0, p.light, 0.9], [1, p.light, 0]]);
  c.fill();
  leg(c, p, 42, 22, 60, 27, p.fur, 5, false, true);
  if (!cat) collar(c, 44, 11.5, 9.5);
  if (cat) {
    for (const pts of [[[48, 10], [50, 1], [55, 8]], [[55, 7], [60, 0.5], [61.5, 9]]] as [number, number][][]) {
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      fillOut(c, css(p.fur), outline(p), 1.1);
    }
  }
  circle(c, 54, 14, 10);
  fillOut(c, rad(c, 50.5, 10, 1, 54, 14, 11.5, [[0, shade(p.fur, 0.32)], [0.55, p.fur], [1, shade(p.fur, -0.28)]]), outline(p), 1.4);
  ellipse(c, 61.5, 17, 5.8, 4.2);
  fillOut(c, css(p.light), cat ? undefined : outline(p), 1);
  nose(c, 66.5, 15.5, cat ? 1.8 : 2.6, cat ? 0xe07a8a : NOSE);
  if (!cat) {
    ellipse(c, 48, 9.5, 7.5, 3.6, -0.15);
    fillOut(c, lin(c, 0, 6, 0, 13, [[0, shade(p.dark, 0.2)], [1, shade(p.dark, -0.3)]]), outline(p), 1);
  }
  eye(c, 57, 11, cat ? 0x4caa4c : 0x1a1a1a, cat);
}

/** Makes (once) the textures and run animation for one species and color. */
export function makePetTextures(scene: Phaser.Scene, c: PetChoice): void {
  const key = petKey(c);
  const p = PALETTES[c.palette];
  const body = c.species === 'cat' ? drawCat : drawDog;
  const finish = (cx: Ctx, w: number, h: number) => grain(cx, w, h, 0.04, 0, 3, 64);
  RUN_FEET.forEach((f, i) =>
    paint(scene, `${key}-run-${i}`, 64, 56, (cx) => {
      body(cx, p, f);
      finish(cx, 64, 56);
    }),
  );
  paint(scene, `${key}-jump`, 64, 56, (cx) => {
    body(cx, p, JUMP_FEET);
    finish(cx, 64, 56);
  });
  paint(scene, `${key}-slide`, 70, 30, (cx) => {
    drawSlide(cx, c.species, p);
    finish(cx, 70, 30);
  });
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

export function hasSavedPet(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) !== null;
  } catch {
    return false;
  }
}

export function savePet(c: PetChoice): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(c));
  } catch {
    // Storage can be blocked (private mode); the choice just won't be remembered.
  }
}
