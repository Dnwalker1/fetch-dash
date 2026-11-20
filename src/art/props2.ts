import Phaser from 'phaser';
import type { Theme } from '../levels';
import {
  blob, circle, css, ellipse, fillOut, grain, leaf, lin, line, paint, rad, roundX, roundY, rrect, seeded, shade, type Ctx,
} from './paint';
import { crown, leafCluster, limb } from './props';

/**
 * Painted props for levels 7 to 12 (orchard, canyon, farm, garden, jungle and
 * pier), the water you jump over (puddle, creek, pond) and the critter dens.
 * Obstacles keep the sizes of the flat versions they replace, so hit areas
 * don't change. Light comes from the upper left.
 */

const TAU = Math.PI * 2;
const BARK = 0x6b4423;

export function paintProps2(scene: Phaser.Scene): void {
  paintWater(scene);
  paintOrchard(scene);
  paintCanyon(scene);
  paintFarm(scene);
  paintGarden(scene);
  paintJungle(scene);
  paintPier(scene);
}

/** Draws several shapes as one: all the outlines first, then all the fills, so inner seams vanish. */
function united(c: Ctx, shapes: (() => void)[], fills: (string | CanvasGradient)[], outline: number, lw: number): void {
  for (const s of shapes) {
    s();
    c.strokeStyle = css(outline, 0.95);
    c.lineWidth = lw * 2;
    c.stroke();
  }
  shapes.forEach((s, i) => {
    s();
    c.fillStyle = fills[i];
    c.fill();
  });
}

/** Little stones, lit from the upper left. */
function pebble(c: Ctx, x: number, y: number, rx: number, ry: number, base = 0x9a958c): void {
  ellipse(c, x, y, rx, ry);
  fillOut(c, rad(c, x - rx * 0.4, y - ry * 0.5, 0.2, x, y, rx * 1.15, [[0, shade(base, 0.35)], [0.55, base], [1, shade(base, -0.4)]]), shade(base, -0.6), 0.8);
}

/** Grass blades in a little tuft. */
function tuft(c: Ctx, r: () => number, x: number, y: number, h: number, greens: number[]): void {
  for (let i = 0; i < 6; i++) {
    const lean = (r() - 0.5) * h * 0.9;
    c.beginPath();
    c.moveTo(x + (r() - 0.5) * 4, y);
    c.quadraticCurveTo(x + lean * 0.2, y - h * 0.6, x + lean, y - h * (0.6 + r() * 0.4));
    c.strokeStyle = css(greens[i % greens.length]);
    c.lineWidth = 0.9 + r() * 0.6;
    c.stroke();
  }
}

// ---------- Water to jump: puddle, creek, pond ----------
//
// These lie flat on the trail, so they're drawn as if seen from a little
// above: the far bank at the top, the near bank at the bottom. Their hit
// area is set separately (a thin band at the ground line), not from the
// picture's size.

/** An uneven oval for a shoreline. */
function shore(c: Ctx, cx: number, cy: number, rx: number, ry: number, seed: number, wobble = 0.08): void {
  const r = seeded(seed);
  const pts: [number, number][] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + (r() - 0.5) * 2 * wobble;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * (1 + (r() - 0.5) * wobble)]);
  }
  blob(c, pts);
}

/** Wet ground around the water: dark and soft-edged, over whatever the trail is. */
function wetRing(c: Ctx, cx: number, cy: number, rx: number, ry: number, seed: number): void {
  c.save();
  c.translate(cx, cy);
  c.scale(1, ry / rx);
  shore(c, 0, 0, rx, rx, seed, 0.06);
  c.fillStyle = rad(c, 0, 0, rx * 0.6, 0, 0, rx, [[0, 0x2a1e12, 0.55], [0.8, 0x2a1e12, 0.4], [1, 0x2a1e12, 0]]);
  c.fill();
  c.restore();
}

/** Water seen at a low angle: the sky's glow on the far side, deeper and darker near us. */
function waterFill(c: Ctx, y0: number, y1: number, far: number, mid: number, near: number): CanvasGradient {
  return lin(c, 0, y0, 0, y1, [[0, shade(far, -0.25)], [0.18, far], [0.5, mid], [1, near]]);
}

function sparkle(c: Ctx, r: () => number, x0: number, x1: number, y0: number, y1: number, n: number, clip: () => void): void {
  c.save();
  clip();
  c.clip();
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * (x1 - x0);
    const y = y0 + r() * (y1 - y0);
    const w = 3 + r() * 9;
    line(c, [[x, y], [x + w * 0.5, y - 0.4], [x + w, y]], 0xffffff, 0.8 + r() * 0.5, 0.35 + r() * 0.45);
  }
  c.restore();
}

function paintWater(scene: Phaser.Scene): void {
  // Puddle: 96 x 26, the water from about y 5 to y 21
  paint(scene, 'puddle', 96, 26, (c) => {
    const r = seeded(41);
    wetRing(c, 48, 13.5, 47, 11.5, 41);
    const water = () => shore(c, 48, 13, 41, 7.6, 42, 0.07);
    water();
    fillOut(c, waterFill(c, 5, 21, 0xcfe8fb, 0x7fb2dc, 0x3a6a96), 0x3a2a1a, 1, 0.5);
    // the far bank's reflection, then the sky's
    c.save();
    water();
    c.clip();
    ellipse(c, 48, 6.5, 40, 2.6);
    c.fillStyle = css(0x2f4a2a, 0.35);
    c.fill();
    ellipse(c, 34, 11, 16, 2.2);
    c.fillStyle = css(0xffffff, 0.35);
    c.fill();
    // ripple rings from a drip
    for (const [x, y, k] of [[62, 14, 1], [26, 16, 0.7]] as [number, number, number][]) {
      for (const s of [1, 1.8]) {
        ellipse(c, x, y, 5 * s * k, 1.6 * s * k);
        c.strokeStyle = css(0xffffff, 0.45 / s);
        c.lineWidth = 0.7;
        c.stroke();
      }
    }
    c.restore();
    sparkle(c, r, 14, 80, 9, 19, 7, water);
    // the near lip of mud catches the light
    c.beginPath();
    c.ellipse(48, 13, 41, 7.6, 0, 0.25, Math.PI - 0.25);
    c.strokeStyle = css(0x6b5236, 0.75);
    c.lineWidth = 1.3;
    c.stroke();
    for (const [x, y, s] of [[10, 18, 2.2], [15, 21, 1.6], [83, 19, 2], [88, 15.5, 1.5], [60, 22.5, 1.4]]) pebble(c, x, y, s, s * 0.7);
    for (const [x, h] of [[18, 6], [70, 5], [86, 7]]) tuft(c, r, x, 6.5, h, [0x3f7a2e, 0x5f9c3a, 0x8dbb4f]);
  });

  // Creek: 156 x 30, a stream across the trail with stones on both banks
  paint(scene, 'creek', 156, 30, (c) => {
    const r = seeded(43);
    wetRing(c, 78, 15.5, 77, 14, 43);
    const water = () => shore(c, 78, 15, 72, 10.5, 44, 0.05);
    water();
    fillOut(c, waterFill(c, 4, 26, 0xbcd8ea, 0x5f8fb4, 0x2c5578), 0x2a2218, 1.1, 0.6);
    c.save();
    water();
    c.clip();
    // current: long streaks that bend downstream (to the left)
    for (let i = 0; i < 22; i++) {
      const x = 12 + r() * 128;
      const y = 7 + r() * 17;
      const w = 10 + r() * 24;
      const light = i % 3 !== 0;
      line(c, [[x + w, y - 0.6], [x + w * 0.5, y + 0.5], [x, y]], light ? 0xffffff : 0x1f3e5c, light ? 0.9 : 1.1, light ? 0.4 + r() * 0.3 : 0.35);
    }
    ellipse(c, 78, 6.5, 70, 2.4);
    c.fillStyle = css(0x23401f, 0.3);
    c.fill();
    c.restore();
    // stones on the banks, with a little white water where the current hits them
    const stones: [number, number, number, number][] = [
      [8, 15, 7, 5], [16, 21, 5, 3.4], [22, 9, 4, 2.6], [140, 13, 7.5, 5], [148, 20, 5, 3.5], [132, 22, 4.5, 3], [128, 7.5, 3.5, 2.2],
      [64, 25.5, 4, 2.4], [92, 26, 3, 1.8], [80, 5.8, 3, 1.6],
    ];
    for (const [x, y, rx, ry] of stones) {
      if (x > 30 && x < 120 && y > 10 && y < 22) continue;
      ellipse(c, x + rx * 0.6, y + ry * 0.2, rx * 0.8, ry * 0.45);
      c.fillStyle = css(0xffffff, 0.45);
      c.fill();
      pebble(c, x, y, rx, ry, 0x8f9298);
      ellipse(c, x - rx * 0.2, y - ry * 0.75, rx * 0.5, ry * 0.25);
      c.fillStyle = css(0x5f9c3a, 0.8);
      c.fill();
    }
    for (const x of [30, 46, 112, 124]) tuft(c, r, x, 5.5, 6 + r() * 3, [0x3f7a2e, 0x5f9c3a, 0x8dbb4f]);
  });

  // Pond: 156 x 30, a garden pond with lily pads, a lotus and a koi
  paint(scene, 'pond', 156, 30, (c) => {
    const r = seeded(47);
    wetRing(c, 78, 15.5, 77, 14, 47);
    const water = () => shore(c, 78, 15, 70, 10.5, 48, 0.04);
    water();
    fillOut(c, waterFill(c, 4, 26, 0xd6ecf2, 0x6aa8b8, 0x2f6a78), 0x2a2a28, 1, 0.6);
    c.save();
    water();
    c.clip();
    // a koi just under the surface
    c.save();
    c.translate(56, 17);
    c.rotate(-0.12);
    ellipse(c, 0, 0, 8, 2.6);
    c.fillStyle = lin(c, -8, 0, 8, 0, [[0, 0xf6a65a, 0.85], [1, 0xe0602a, 0.85]]);
    c.fill();
    c.beginPath();
    c.moveTo(7, 0);
    c.lineTo(12, -2.6);
    c.lineTo(11, 2.6);
    c.closePath();
    c.fillStyle = css(0xe0602a, 0.75);
    c.fill();
    ellipse(c, -2, -0.6, 2.4, 1.2);
    c.fillStyle = css(0xffffff, 0.8);
    c.fill();
    c.restore();
    ellipse(c, 78, 6.4, 68, 2.2);
    c.fillStyle = css(0x3a5a2a, 0.3);
    c.fill();
    c.restore();
    sparkle(c, r, 20, 136, 9, 22, 8, water);
    // lily pads, with a notch, and a pink lotus
    for (const [x, y, s] of [[104, 13, 6], [116, 18, 5], [94, 20, 4], [36, 11, 4.5]] as [number, number, number][]) {
      c.beginPath();
      c.ellipse(x, y, s, s * 0.42, 0, 0.35, TAU - 0.05);
      c.lineTo(x, y);
      c.closePath();
      fillOut(c, rad(c, x - s * 0.4, y - s * 0.2, 0.3, x, y, s, [[0, 0x8fc860], [0.6, 0x5a9a3a], [1, 0x3a6a2a]]), 0x2a4a1e, 0.8);
      line(c, [[x, y], [x - s * 0.6, y - s * 0.15]], 0x9fd070, 0.6, 0.6);
    }
    for (let i = 0; i < 7; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      leaf(c, 106, 12, 5.5, 2.2, a * 0.9 - 0.15, i % 2 ? 0xf4b6c8 : 0xe891ab, 0xc0607e);
    }
    circle(c, 106, 11.2, 1.6);
    c.fillStyle = css(0xf2d45a);
    c.fill();
    // round stones edging the pond
    const edge: [number, number, number, number][] = [
      [8, 16, 7, 5], [14, 23, 6, 4], [24, 26.5, 5.5, 3.2], [148, 15, 7, 5], [142, 22.5, 6, 4], [132, 26.5, 5.5, 3.2], [20, 8, 5, 3], [136, 8, 5, 3],
    ];
    for (const [x, y, rx, ry] of edge) pebble(c, x, y, rx, ry, 0xa8a49a);
    for (const [x, y] of [[9, 11.5], [147, 10.5], [31, 5]]) {
      ellipse(c, x, y, 3, 1.4);
      c.fillStyle = css(0x6a9a4a, 0.9);
      c.fill();
    }
  });
}

// ---------- Dens: a mound of earth with a hole a critter pops out of ----------

export const DEN_W = 84;
export const DEN_H = 42;
/** Middle of the hole, from the den picture's bottom edge. */
export const DEN_HOLE_UP = 17;
const HX = 42;
const HY = DEN_H - DEN_HOLE_UP;
const HRX = 15;
const HRY = 9.5;

/**
 * Paints the den for a level, in that level's earth: dirt and grass, sand,
 * or snow. Two pictures: the mound with its hole (behind the critter), and
 * the mound's front lip (in front of it), so the critter pops up out of the hole.
 */
export function paintDen(scene: Phaser.Scene, levelId: number, t: Theme): { back: string; lip: string } {
  const back = `den-${levelId}`;
  const lip = `den-${levelId}-lip`;
  const look =
    t.tufts === 'snow'
      ? { lit: 0xffffff, base: 0xdfe4f4, dark: 0x9aa4c8, out: 0x5a6488, grass: [] as number[], pebble: 0x8a90a8 }
      : t.tufts === 'sand'
        ? { lit: shade(t.grass, 0.35), base: t.grass, dark: shade(t.grass, -0.3), out: shade(t.grass, -0.6), grass: [0x9a9a4a, 0xb8b060], pebble: 0xb0a088 }
        : { lit: shade(t.dirt, 0.3), base: t.dirt, dark: shade(t.dirtDark, -0.2), out: shade(t.dirtDark, -0.55), grass: [t.grassDark, t.grass, shade(t.grass, 0.25)], pebble: 0x9a958c };
  const moundPath = (c: Ctx) => blob(c, [[1, 41.5], [6, 30], [16, 18], [30, 11], [44, 9], [58, 12], [70, 20], [78, 31], [83, 41.5]]);
  const mound = (c: Ctx) => {
    const r = seeded(60 + levelId);
    // a soft shadow where it sits
    ellipse(c, HX + 2, DEN_H - 2, 41, 3.5);
    c.fillStyle = css(0x000000, 0.22);
    c.fill();
    moundPath(c);
    fillOut(c, rad(c, 26, 12, 2, 42, 30, 44, [[0, look.lit], [0.45, look.base], [1, look.dark]]), look.out, 1.3);
    // clods and crumbs of earth, lit on top
    c.save();
    moundPath(c);
    c.clip();
    for (let i = 0; i < 40; i++) {
      const x = 4 + r() * 76;
      const y = 12 + r() * 28;
      const s = 0.8 + r() * 1.8;
      ellipse(c, x, y, s, s * 0.7);
      c.fillStyle = css(r() < 0.5 ? shade(look.base, 0.25) : shade(look.base, -0.3), 0.6);
      c.fill();
    }
    c.restore();
    for (let i = 0; i < 6; i++) pebble(c, 8 + r() * 68, 30 + r() * 9, 1.6 + r() * 1.4, 1.2 + r(), look.pebble);
    if (look.grass.length) for (const [x, y] of [[9, 31], [20, 18], [64, 17], [76, 31], [33, 11.5]]) tuft(c, r, x, y, 5 + r() * 3, look.grass);
    if (t.tufts === 'snow') {
      // a few bits of earth peek through the snow
      for (const [x, y] of [[24, 30], [60, 33], [14, 37]]) {
        ellipse(c, x, y, 3, 1.3);
        c.fillStyle = css(0x6b5a4a, 0.55);
        c.fill();
      }
    }
  };
  const hole = (c: Ctx) => {
    // a lit rim of dug earth, then the dark way down
    ellipse(c, HX, HY - 0.8, HRX + 2.2, HRY + 2);
    c.fillStyle = css(shade(look.base, -0.15));
    c.fill();
    ellipse(c, HX, HY, HRX, HRY);
    c.fillStyle = rad(c, HX + 1, HY + 2, 1, HX, HY, HRX, [[0, 0x0a0604], [0.6, 0x1a120a], [1, 0x3a2a1a]]);
    c.fill();
    c.beginPath();
    c.ellipse(HX, HY, HRX, HRY, 0, Math.PI * 1.05, Math.PI * 1.95);
    c.strokeStyle = css(0x000000, 0.35);
    c.lineWidth = 2;
    c.stroke();
  };
  paint(scene, back, DEN_W, DEN_H, (c) => {
    mound(c);
    hole(c);
    grain(c, DEN_W, DEN_H, 0.06, 0, 61, 64);
  });
  paint(scene, lip, DEN_W, DEN_H, (c) => {
    // only the part of the mound below the hole's lower edge
    c.save();
    c.beginPath();
    c.moveTo(0, HY);
    c.lineTo(HX - HRX, HY);
    c.ellipse(HX, HY, HRX, HRY, 0, Math.PI, 0, true);
    c.lineTo(DEN_W, HY);
    c.lineTo(DEN_W, DEN_H);
    c.lineTo(0, DEN_H);
    c.closePath();
    c.clip();
    mound(c);
    c.restore();
    // the lip of the hole catches the light
    c.beginPath();
    c.ellipse(HX, HY, HRX, HRY, 0, 0.15, Math.PI - 0.15);
    c.strokeStyle = css(look.lit, 0.8);
    c.lineWidth = 1.4;
    c.stroke();
    grain(c, DEN_W, DEN_H, 0.06, 0, 61, 64);
  });
  return { back, lip };
}

// ---------- Level 7: Autumn Orchard ----------

function paintOrchard(scene: Phaser.Scene): void {
  const autumn = [0x8a3418, 0xc9602a, 0xe8a63a];

  paint(scene, 'haybale', 56, 40, (c) => {
    const r = seeded(70);
    const out = 0x7a5a24;
    const body = () => rrect(c, 1, 3, 54, 36.3, 9);
    body();
    fillOut(c, lin(c, 0, 3, 0, 39, [[0, 0xf8e08e], [0.3, 0xe8c462], [1, 0xb08a3a]]), out, 1.4);
    c.save();
    body();
    c.clip();
    c.fillStyle = lin(c, 1, 0, 55, 0, [[0, 0xffffff, 0.14], [0.35, 0xffffff, 0], [1, 0x000000, 0.2]]);
    c.fillRect(0, 0, 56, 40);
    // straw: lots of short strokes, mostly lying along the bale
    const straws = [0xfff2b8, 0xf2d27a, 0xd6aa4a, 0xb88a34, 0x9a7028];
    for (let i = 0; i < 300; i++) {
      const x = r() * 58 - 1;
      const y = 4 + r() * 36;
      const a = (r() - 0.5) * 0.9 + (r() < 0.3 ? Math.PI / 2 : 0);
      const len = 3 + r() * 6;
      const col = straws[Math.min(4, Math.floor(r() * 3 + (y / 40) * 2))];
      line(c, [[x, y], [x + Math.cos(a) * len, y + Math.sin(a) * len]], col, 0.7 + r() * 0.5, 0.75);
    }
    // the top is a little brighter
    rrect(c, 1, 3, 54, 7, 6);
    c.fillStyle = css(0xfff4c0, 0.22);
    c.fill();
    // two twine bands
    for (const x of [14, 40]) {
      line(c, [[x, 3], [x + 0.8, 20], [x, 40]], 0x5a2e16, 3.2);
      line(c, [[x - 0.4, 3], [x + 0.4, 20], [x - 0.4, 40]], 0xa8603a, 1.6);
      for (let y = 6; y < 40; y += 3.2) line(c, [[x - 1.2, y], [x + 0.8, y + 1.4]], 0x6b3a1e, 0.6, 0.6);
    }
    c.restore();
    // loose straws poking out
    for (let i = 0; i < 16; i++) {
      const x = 4 + r() * 48;
      line(c, [[x, 4.5], [x + (r() - 0.5) * 6, 0.5 + r() * 2]], r() < 0.5 ? 0xe8c462 : 0xc49a3c, 0.8);
    }
    for (const x of [1.5, 54.5]) for (let i = 0; i < 4; i++) {
      const y = 10 + r() * 24;
      line(c, [[x, y], [x + (x < 20 ? -1 : 1) * (1 + r() * 1.5), y + (r() - 0.5) * 4]], 0xd6aa4a, 0.8);
    }
    grain(c, 56, 40, 0.06, 0, 71, 64);
  });

  paint(scene, 'pumpkin', 40, 34, (c) => {
    const out = 0x7a3010;
    const lobes: [number, number, number, number, number][] = [
      [7.5, 21.5, 7.2, 11.3, -0.15], [32.5, 21.5, 7.2, 11.3, -0.25], [13, 21.5, 8.6, 12.3, 0], [27, 21.5, 8.6, 12.3, -0.1], [20, 21.5, 9.2, 12.6, 0.08],
    ];
    for (const [x, y, rx, ry, k] of lobes) {
      ellipse(c, x, y, rx, ry);
      fillOut(c, rad(c, x - rx * 0.35, y - ry * 0.45, 0.5, x, y, ry * 1.05, [[0, shade(0xf09a3a, 0.25 + k)], [0.5, shade(0xe07a24, k)], [1, shade(0xb04a14, k)]]), out, 1.2);
      line(c, [[x - rx * 0.3, y - ry * 0.7], [x - rx * 0.45, y], [x - rx * 0.3, y + ry * 0.7]], 0xffc070, 0.9, 0.3);
    }
    // the stem, a curly vine and a leaf
    c.beginPath();
    c.moveTo(18, 10.5);
    c.quadraticCurveTo(17.5, 6, 19.5, 2.5);
    c.lineTo(23, 3);
    c.quadraticCurveTo(21.5, 6.5, 22.5, 10.5);
    c.closePath();
    fillOut(c, roundX(c, 17.5, 23, 0x6b7a2a, 0.3, -0.4), 0x3a3a14, 1);
    c.beginPath();
    c.moveTo(22, 6);
    c.bezierCurveTo(27, 2, 30, 8, 27, 9);
    c.bezierCurveTo(25, 9.5, 25.5, 6.5, 27.5, 6.5);
    c.strokeStyle = css(0x5a7a2a, 0.9);
    c.lineWidth = 0.9;
    c.stroke();
    leaf(c, 16, 7.5, 9, 3.6, Math.PI + 0.35, 0x5f8a2e, 0x2f4a14);
    ellipse(c, 15.5, 15, 3, 1.6, -0.4);
    c.fillStyle = css(0xffffff, 0.35);
    c.fill();
    grain(c, 40, 34, 0.05, 0, 73, 64);
  });

  paint(scene, 'autumnbranch', 110, 50, (c) => {
    limb(c, BARK);
    const r = seeded(74);
    for (const [x, y, s] of [[10, 24, 12], [28, 32, 13], [48, 34, 12], [64, 28, 12], [84, 22, 11], [22, 19, 9], [56, 20, 9], [94, 15, 8], [40, 26, 10]]) {
      leafCluster(c, r, x, y, s, autumn, 49);
    }
    // a couple of apples among the leaves
    for (const [x, y] of [[30, 36], [66, 33]]) {
      circle(c, x, y, 3.6);
      fillOut(c, rad(c, x - 1.3, y - 1.3, 0.3, x, y, 3.8, [[0, 0xff8a6a], [0.5, 0xd8302a], [1, 0x8a1a14]]), 0x5a1210, 0.8);
      line(c, [[x, y - 3.4], [x + 0.6, y - 5.6]], 0x4a3220, 0.8);
    }
  });

  paint(scene, 'canopy-autumn', 180, 110, (c) => {
    crown(c, [[30, 62, 33], [90, 72, 38], [150, 60, 31], [60, 38, 30], [120, 36, 31], [90, 30, 26]], [0x7a2a14, 0xc0562a, 0xe89a3a, 0xf6cc5a], 75, 180, 110);
  });
}

// ---------- Level 8: Desert Canyon ----------

function paintCanyon(scene: Phaser.Scene): void {
  paint(scene, 'cactus', 34, 52, (c) => {
    const green = 0x4f8a4a;
    const out = 0x1f3e1e;
    // a little sand heaped at the foot
    ellipse(c, 17.5, 50.5, 12, 2.6);
    c.fillStyle = css(0xd8a870, 0.9);
    c.fill();
    const trunk = () => rrect(c, 10.5, 1, 14, 50, 7);
    const armL = () => {
      c.beginPath();
      c.moveTo(12, 28.5);
      c.lineTo(5, 28.5);
      c.quadraticCurveTo(1, 28.5, 1, 24.5);
      c.lineTo(1, 17);
      c.arc(5, 17, 4, Math.PI, 0);
      c.lineTo(9, 23.5);
      c.lineTo(12, 23.5);
      c.closePath();
    };
    const armR = () => {
      c.beginPath();
      c.moveTo(23, 25.5);
      c.lineTo(28, 25.5);
      c.quadraticCurveTo(30.5, 25.5, 30.5, 23);
      c.lineTo(30.5, 11);
      c.arc(27, 11, 3.5, 0, Math.PI, true);
      c.lineTo(23.5, 20);
      c.lineTo(23, 20);
      c.closePath();
    };
    united(c, [armL, armR, trunk], [roundX(c, 1, 9, green, 0.3, -0.35), roundX(c, 23.5, 30.5, green, 0.3, -0.35), roundX(c, 10.5, 24.5, green, 0.32, -0.4)], out, 1.2);
    // ribs and spines
    for (const x of [14, 17.5, 21]) line(c, [[x, 4], [x, 48]], shade(green, x < 17 ? 0.35 : -0.35), 0.8, 0.6);
    for (const x of [3.5, 6.5]) line(c, [[x, 15], [x, 26]], shade(green, -0.3), 0.7, 0.5);
    for (const x of [26, 29]) line(c, [[x, 10], [x, 23]], shade(green, -0.3), 0.7, 0.5);
    const r = seeded(80);
    for (let i = 0; i < 26; i++) {
      const pick = r();
      const [x, y] = pick < 0.6 ? [11 + r() * 13, 4 + r() * 44] : pick < 0.8 ? [1.5 + r() * 7, 15 + r() * 12] : [24 + r() * 6.5, 10 + r() * 14];
      line(c, [[x, y], [x + (r() - 0.5) * 2.4, y - 1.2]], 0xf4efd8, 0.6, 0.85);
    }
    // a pink flower on top
    for (let i = 0; i < 5; i++) leaf(c, 17.5, 2.5, 4, 1.8, Math.PI + (i / 4) * Math.PI, i % 2 ? 0xf4709a : 0xe0507a);
    circle(c, 17.5, 2.2, 1.2);
    c.fillStyle = css(0xf2d45a);
    c.fill();
    grain(c, 34, 52, 0.05, 0, 81, 64);
  });

  paint(scene, 'tumbleweed', 40, 38, (c) => {
    const r = seeded(82);
    circle(c, 20, 19, 16);
    c.fillStyle = rad(c, 20, 19, 2, 20, 19, 17, [[0, 0x5a3e22, 0.55], [1, 0x5a3e22, 0.15]]);
    c.fill();
    // a tangle of twigs: darker at the back and bottom right, sunlit at the top left
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < 70; i++) {
        const a = r() * TAU;
        const d = Math.sqrt(r()) * 15;
        const x = 20 + Math.cos(a) * d;
        const y = 19 + Math.sin(a) * d * 0.95;
        const ang = r() * TAU;
        const len = 5 + r() * 9;
        const bend = (r() - 0.5) * 6;
        const lit = (-(x - 20) - (y - 19)) / 22;
        const col = pass === 0 ? 0x5a3e22 : pass === 1 ? (lit > 0 ? 0xa8844e : 0x7a5a32) : lit > 0.2 ? 0xe0c48a : 0xb8945a;
        const ex = x + Math.cos(ang) * len;
        const ey = y + Math.sin(ang) * len;
        if (Math.hypot(ex - 20, ey - 19) > 17.5) continue;
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo((x + ex) / 2 + bend, (y + ey) / 2 - bend, ex, ey);
        c.strokeStyle = css(col, pass === 2 ? 0.95 : 0.85);
        c.lineWidth = pass === 2 ? 0.8 : 1.1;
        c.stroke();
      }
    }
    // wiry outer loops
    for (let i = 0; i < 9; i++) {
      const a0 = r() * TAU;
      c.beginPath();
      c.ellipse(20, 19, 16 + r() * 2, 15 + r() * 2, r(), a0, a0 + 0.8 + r() * 0.8);
      c.strokeStyle = css(i % 2 ? 0x8a6a3a : 0xc8a46a, 0.9);
      c.lineWidth = 1;
      c.stroke();
    }
  });

  // A natural sandstone arch: the span is the obstacle, its two legs stand on the trail
  const sandstone = (c: Ctx, w: number, h: number, seed: number, rows: number) => {
    const r = seeded(seed);
    // blocky layers: short ledges of lighter and darker rock
    for (let i = 0; i < rows; i++) {
      const y = 4 + (i * (h - 6)) / rows + r() * 2;
      let x = -4 + r() * 6;
      while (x < w) {
        const len = 8 + r() * 22;
        const light = r() < 0.5;
        line(c, [[x, y], [x + len * 0.5, y + (r() - 0.5) * 1.6], [x + len, y + (r() - 0.5)]], light ? 0xf2a070 : 0x7a2e18, light ? 1.2 : 1, light ? 0.5 : 0.45);
        x += len + 3 + r() * 8;
      }
    }
    // pits and cracks
    for (let i = 0; i < (w * h) / 500; i++) {
      const x = 3 + r() * (w - 6);
      const y = 6 + r() * (h - 10);
      ellipse(c, x, y, 1 + r() * 2, 0.6 + r() * 1.2);
      c.fillStyle = css(0x5a1e0e, 0.4);
      c.fill();
      ellipse(c, x - 0.6, y - 0.8, 1 + r(), 0.5);
      c.fillStyle = css(0xffc8a0, 0.35);
      c.fill();
    }
    for (let i = 0; i < w / 30; i++) {
      const x = 8 + r() * (w - 16);
      const y = 6 + r() * (h * 0.5);
      line(c, [[x, y], [x + (r() - 0.5) * 3, y + 5], [x + (r() - 0.5) * 4, y + 10]], 0x5a1e0e, 0.8, 0.55);
    }
  };

  paint(scene, 'arch', 130, 44, (c) => {
    const rock = 0xd0703e;
    const out = 0x5a2210;
    const shape = () => {
      c.beginPath();
      c.moveTo(0.5, 44);
      c.lineTo(0.8, 16);
      const top: [number, number][] = [[3, 9], [9, 6], [16, 7.5], [22, 4], [30, 5.5], [38, 3], [47, 5], [55, 2.5], [64, 4.5], [72, 2], [82, 4.5], [90, 3], [99, 5.5], [107, 3.5], [116, 6], [123, 5], [128, 9], [129.5, 16]];
      for (const [x, y] of top) c.lineTo(x, y);
      c.lineTo(129.5, 44);
      c.lineTo(112, 44);
      c.bezierCurveTo(108, 34, 92, 33.5, 65, 33.5);
      c.bezierCurveTo(38, 33.5, 22, 34, 18, 44);
      c.closePath();
    };
    shape();
    fillOut(c, roundY(c, 2, 44, rock, 0.35, -0.4), out, 1.4);
    c.save();
    shape();
    c.clip();
    sandstone(c, 130, 44, 84, 6);
    // the shady underside of the span
    c.beginPath();
    c.moveTo(18, 44);
    c.bezierCurveTo(22, 34, 38, 33.5, 65, 33.5);
    c.bezierCurveTo(92, 33.5, 108, 34, 112, 44);
    c.lineTo(112, 26);
    c.bezierCurveTo(90, 25, 40, 25, 18, 26);
    c.closePath();
    c.fillStyle = lin(c, 0, 25, 0, 36, [[0, 0x3a1006, 0], [1, 0x3a1006, 0.45]]);
    c.fill();
    // sunlit top
    c.fillStyle = lin(c, 0, 2, 0, 12, [[0, 0xffd0a0, 0.45], [1, 0xffd0a0, 0]]);
    c.fillRect(0, 0, 130, 12);
    c.restore();
    grain(c, 130, 44, 0.08, 0.08, 85, 64);
  });

  // the arch's legs: rough sandstone pillars, wider at the foot
  paint(scene, 'arch-leg', 20, 84, (c) => {
    const rock = 0xc4653a;
    c.beginPath();
    c.moveTo(1.5, 0);
    c.lineTo(18.5, 0);
    c.quadraticCurveTo(17, 18, 18.8, 34);
    c.quadraticCurveTo(17.4, 52, 19.6, 84);
    c.lineTo(0.4, 84);
    c.quadraticCurveTo(3, 56, 1.2, 40);
    c.quadraticCurveTo(3, 18, 1.5, 0);
    c.closePath();
    fillOut(c, roundX(c, 0, 20, rock, 0.32, -0.45), 0x5a2210, 1.2);
    c.save();
    c.clip();
    sandstone(c, 20, 84, 86, 9);
    c.restore();
    grain(c, 20, 84, 0.08, 0.06, 86, 64);
  });
}

// ---------- Level 9: Sunny Farm ----------

function paintFarm(scene: Phaser.Scene): void {
  paint(scene, 'trough', 70, 26, (c) => {
    const wood = 0x9c7a4c;
    const out = 0x4a3220;
    // legs
    for (const x of [4, 60]) {
      rrect(c, x, 15, 6, 11, 1);
      fillOut(c, roundX(c, x, x + 6, shade(wood, -0.1), 0.25, -0.4), out, 1);
    }
    // the box, wider at the top
    const box = () => {
      c.beginPath();
      c.moveTo(0.8, 3);
      c.lineTo(69.2, 3);
      c.lineTo(63, 20.5);
      c.lineTo(7, 20.5);
      c.closePath();
    };
    box();
    fillOut(c, roundY(c, 3, 20.5, wood, 0.2, -0.35), out, 1.3);
    c.save();
    box();
    c.clip();
    for (const y of [9, 15]) {
      line(c, [[0, y], [70, y]], shade(wood, -0.45), 1, 0.7);
      line(c, [[0, y + 1], [70, y + 1]], shade(wood, 0.3), 0.6, 0.45);
    }
    const r = seeded(90);
    for (let i = 0; i < 14; i++) {
      const y = 4 + r() * 15;
      const x = 6 + r() * 50;
      line(c, [[x, y], [x + 6 + r() * 8, y + (r() - 0.5)]], shade(wood, -0.35), 0.6, 0.45);
    }
    c.restore();
    // end boards and nails
    for (const [x0, x1] of [[0.8, 8], [62, 69.2]]) {
      c.beginPath();
      c.moveTo(x0, 3);
      c.lineTo(x1, 3);
      c.lineTo(x0 < 10 ? 8.6 : 62.4, 20.5);
      c.lineTo(x0 < 10 ? 7 : 63, 20.5);
      c.closePath();
      fillOut(c, css(shade(wood, -0.12)), out, 0.9);
    }
    for (const x of [5, 65]) for (const y of [7, 14]) {
      circle(c, x, y, 0.8);
      c.fillStyle = css(0x2a2a2a);
      c.fill();
    }
    // water at the brim, reflecting the sky
    rrect(c, 2.5, 3, 65, 4.6, 1.5);
    c.fillStyle = lin(c, 0, 3, 0, 7.6, [[0, 0xc8e8fb], [0.5, 0x7ab8e6], [1, 0x3f7fbf]]);
    c.fill();
    line(c, [[10, 4.6], [24, 4.4]], 0xffffff, 0.9, 0.8);
    line(c, [[40, 5.2], [48, 5]], 0xffffff, 0.8, 0.6);
    line(c, [[0.8, 3], [69.2, 3]], shade(wood, 0.35), 1.6);
    line(c, [[0.8, 3], [69.2, 3]], out, 0.6, 0.6);
    grain(c, 70, 26, 0.06, 0, 91, 64);
  });

  paint(scene, 'clothesline', 130, 44, (c) => {
    const ropeY = (x: number) => 3 + Math.sin((x / 130) * Math.PI) * 2.5;
    line(c, Array.from({ length: 14 }, (_, i) => [i * 10, ropeY(i * 10)] as [number, number]), 0x4a4a4a, 1.6);
    line(c, Array.from({ length: 14 }, (_, i) => [i * 10, ropeY(i * 10) - 0.5] as [number, number]), 0xbababa, 0.6, 0.8);
    const cloth = (x: number, w: number, h: number, color: number, draw: (top: number) => void) => {
      const top = ropeY(x + w / 2);
      const shape = () => {
        c.beginPath();
        c.moveTo(x, top);
        c.lineTo(x + w, top);
        c.lineTo(x + w + 0.5, top + h - 2);
        for (let k = 4; k >= 0; k--) c.quadraticCurveTo(x + (k + 0.5) * (w / 5), top + h + 1.5, x + k * (w / 5), top + h - 1);
        c.closePath();
      };
      shape();
      fillOut(c, lin(c, 0, top, 0, top + h, [[0, shade(color, 0.15)], [0.6, color], [1, shade(color, -0.2)]]), shade(color, -0.55), 1.1);
      c.save();
      shape();
      c.clip();
      draw(top);
      // soft folds hanging from the pegs
      for (let k = 1; k < 4; k++) {
        const fx = x + (k / 4) * w;
        line(c, [[fx, top + 2], [fx + 1, top + h * 0.6], [fx - 0.5, top + h]], shade(color, -0.3), 2, 0.35);
        line(c, [[fx + 1.6, top + 2], [fx + 2.4, top + h * 0.6], [fx + 1.2, top + h]], shade(color, 0.3), 1, 0.4);
      }
      c.fillStyle = lin(c, x, 0, x + w, 0, [[0, 0xffffff, 0.12], [0.5, 0xffffff, 0], [1, 0x000000, 0.12]]);
      c.fillRect(x, top, w, h + 2);
      c.restore();
      for (const px of [x + 3, x + w - 3]) {
        rrect(c, px - 1.4, top - 3, 2.8, 7, 1);
        fillOut(c, roundX(c, px - 1.4, px + 1.4, 0xc49a5c, 0.3, -0.3), 0x5a3e22, 0.7);
      }
    };
    cloth(6, 30, 38, 0xf4efe4, (top) => {
      for (const y of [8, 26]) {
        c.fillStyle = css(0x6fa8d8, 0.85);
        c.fillRect(6, top + y, 30, 3);
      }
    });
    // a red shirt with sleeves
    const shirtTop = ropeY(52);
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(52 + s * 11, shirtTop + 1);
      c.lineTo(52 + s * 17.5, shirtTop + 9);
      c.lineTo(52 + s * 13.5, shirtTop + 13);
      c.lineTo(52 + s * 10, shirtTop + 8);
      c.closePath();
      fillOut(c, css(shade(0xd04a3a, s < 0 ? 0.05 : -0.12)), 0x6a1a12, 1);
    }
    cloth(41, 22, 34, 0xd04a3a, (top) => {
      c.beginPath();
      c.moveTo(48, top);
      c.lineTo(52, top + 5);
      c.lineTo(56, top);
      c.strokeStyle = css(0x7a1e14, 0.8);
      c.lineWidth = 1;
      c.stroke();
      for (const y of [10, 17, 24]) {
        circle(c, 52, top + y, 0.9);
        c.fillStyle = css(0xf4efe4);
        c.fill();
      }
    });
    cloth(68, 28, 40, 0xf2c84a, (top) => {
      for (const y of [30, 34]) {
        c.fillStyle = css(0xe0702a, 0.8);
        c.fillRect(68, top + y, 28, 2);
      }
    });
    cloth(100, 11, 22, 0x5a8ad0, (top) => {
      c.fillStyle = css(0xffffff, 0.8);
      c.fillRect(100, top + 2, 11, 2);
    });
    cloth(114, 11, 24, 0x5a8ad0, (top) => {
      c.fillStyle = css(0xffffff, 0.8);
      c.fillRect(114, top + 2, 11, 2);
    });
    grain(c, 130, 44, 0.04, 0, 93, 64);
  });

  paint(scene, 'wood-post', 6, 90, (c) => {
    c.fillStyle = roundX(c, 0, 6, 0x8a6a44, 0.3, -0.45);
    c.fillRect(0, 0, 6, 90);
    for (let y = 8; y < 90; y += 13) line(c, [[1.5, y], [2, y + 6]], 0x4a3220, 0.6, 0.5);
    line(c, [[0.4, 0], [0.4, 90]], 0x3a2614, 0.8, 0.8);
    line(c, [[5.6, 0], [5.6, 90]], 0x3a2614, 0.8, 0.8);
  });
}

// ---------- Level 10: Blossom Garden ----------

/** Pink blossom clusters along a branch: little five-petal flowers and a few leaves. */
function blossoms(c: Ctx, r: () => number, x: number, y: number, size: number, maxY: number): void {
  const pinks = [0xc8607e, 0xe891ab, 0xf6c2d2, 0xfde6ee];
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * 0.5 + (r() - 0.5) * 2.6;
    leaf(c, x + Math.cos(a) * size * 0.5, y + Math.sin(a) * size * 0.4, 5, 2, a, 0x6a9a4a, 0x3a5a2a);
  }
  for (let i = 0; i < 9; i++) {
    const a = r() * TAU;
    const d = Math.sqrt(r()) * size * 0.75;
    const fx = x + Math.cos(a) * d;
    const fy = Math.min(maxY - 3, y + Math.sin(a) * d * 0.7);
    const lit = (-(fx - x) - (fy - y)) / size;
    const col = pinks[Math.max(0, Math.min(3, Math.round(1.5 + lit * 2 + (r() - 0.5))))];
    const pr = 2 + r() * 1.2;
    for (let k = 0; k < 5; k++) {
      const pa = (k / 5) * TAU + r();
      circle(c, fx + Math.cos(pa) * pr * 0.7, fy + Math.sin(pa) * pr * 0.7, pr * 0.62);
      c.fillStyle = css(col);
      c.fill();
    }
    circle(c, fx, fy, pr * 0.35);
    c.fillStyle = css(0xb04060);
    c.fill();
    circle(c, fx - 0.3, fy - 0.3, pr * 0.16);
    c.fillStyle = css(0xf2d45a);
    c.fill();
  }
}

function paintGarden(scene: Phaser.Scene): void {
  paint(scene, 'blossombranch', 110, 50, (c) => {
    limb(c, 0x5a3a2a);
    const r = seeded(100);
    for (const [x, y, s] of [[10, 24, 12], [28, 32, 13], [48, 34, 12], [64, 28, 12], [84, 22, 11], [22, 19, 9], [56, 20, 9], [94, 15, 8], [40, 26, 10]]) {
      blossoms(c, r, x, y, s, 49);
    }
  });

  paint(scene, 'canopy-blossom', 180, 110, (c) => {
    const puffs: [number, number, number][] = [[30, 62, 33], [90, 72, 38], [150, 60, 31], [60, 38, 30], [120, 36, 31], [90, 30, 26]];
    crown(c, puffs, [0xb04a6a, 0xe07a9a, 0xf4b0c4, 0xfde0ea], 101, 180, 110);
    const r = seeded(102);
    for (let i = 0; i < 60; i++) {
      const [x, y, rr] = puffs[Math.floor(r() * puffs.length)];
      const a = r() * TAU;
      const d = Math.sqrt(r()) * rr * 0.9;
      const fx = x + Math.cos(a) * d;
      const fy = y + Math.sin(a) * d;
      for (let k = 0; k < 5; k++) {
        const pa = (k / 5) * TAU;
        circle(c, fx + Math.cos(pa) * 1.6, fy + Math.sin(pa) * 1.6, 1.4);
        c.fillStyle = css(fy < y ? 0xfff0f4 : 0xf6c2d2);
        c.fill();
      }
    }
  });

  paint(scene, 'lantern', 30, 46, (c) => {
    const stone = 0x9a9a8e;
    const out = 0x3e3e38;
    const r = seeded(103);
    // base, post, light box, roof and the little knob on top
    rrect(c, 3, 40, 24, 6, 1.5);
    fillOut(c, roundY(c, 40, 46, stone, 0.25, -0.4), out, 1.1);
    rrect(c, 10.5, 26, 9, 15, 1);
    fillOut(c, roundX(c, 10.5, 19.5, stone, 0.3, -0.4), out, 1.1);
    rrect(c, 6, 15, 18, 12, 1.2);
    fillOut(c, roundX(c, 6, 24, stone, 0.25, -0.4), out, 1.1);
    rrect(c, 10, 17.5, 10, 7, 0.8);
    c.fillStyle = rad(c, 15, 21, 0.5, 15, 21, 7, [[0, 0xfff6c8], [0.6, 0xffd27a], [1, 0xe8962a]]);
    c.fill();
    line(c, [[15, 17.5], [15, 24.5]], out, 0.8, 0.7);
    c.beginPath();
    c.moveTo(0.5, 16);
    c.quadraticCurveTo(8, 12.5, 12, 6.5);
    c.lineTo(18, 6.5);
    c.quadraticCurveTo(22, 12.5, 29.5, 16);
    c.quadraticCurveTo(15, 14, 0.5, 16);
    c.closePath();
    fillOut(c, roundY(c, 6, 16, stone, 0.35, -0.35), out, 1.1);
    rrect(c, 12.5, 3.5, 5, 3.5, 1);
    fillOut(c, css(stone), out, 0.9);
    circle(c, 15, 2.6, 2.2);
    fillOut(c, rad(c, 14, 1.8, 0.3, 15, 2.6, 2.4, [[0, 0xd0d0c6], [1, 0x7a7a70]]), out, 0.8);
    // moss in the cracks and on the roof
    for (const [x, y, s] of [[4, 15.2, 3], [24, 15.6, 2.4], [7, 41, 2.5], [22, 41.5, 2], [11.5, 34, 1.4]]) {
      for (let k = 0; k < 4; k++) {
        ellipse(c, x + (r() - 0.5) * s * 1.5, y + (r() - 0.5) * s * 0.4, s * 0.55, s * 0.32);
        c.fillStyle = css(k % 2 ? 0x6a9a4a : 0x4a7a3a, 0.85);
        c.fill();
      }
    }
    grain(c, 30, 46, 0.08, 0, 104, 64);
  });
}

// ---------- Level 11: Jungle Falls ----------

function paintJungle(scene: Phaser.Scene): void {
  paint(scene, 'vines', 110, 56, (c) => {
    const r = seeded(110);
    // a mossy bough across the top
    c.beginPath();
    c.moveTo(110, 1.5);
    c.quadraticCurveTo(55, 4, 2, 7);
    c.quadraticCurveTo(-1, 10.5, 2, 13);
    c.quadraticCurveTo(55, 12.5, 110, 12);
    c.closePath();
    fillOut(c, roundY(c, 2, 13, 0x5b3b22, 0.3, -0.4), 0x2a1a0e, 1.2);
    for (let i = 0; i < 18; i++) {
      const x = 4 + r() * 104;
      ellipse(c, x, 4 + (110 - x) * 0.02 + r() * 2, 3 + r() * 3, 1.4);
      c.fillStyle = css(r() < 0.5 ? 0x5a9a3a : 0x7aba4a, 0.9);
      c.fill();
    }
    // hanging vines with leaves along them
    for (let x = 7; x < 108; x += 11 + r() * 3) {
      const len = 28 + ((x * 7) % 20) + r() * 6;
      const sway = (r() - 0.5) * 6;
      const y0 = 9 + (110 - x) * 0.02;
      const pts: [number, number][] = [];
      for (let k = 0; k <= 8; k++) pts.push([x + Math.sin(k * 0.8 + x) * 1.4 + sway * (k / 8), y0 + (len * k) / 8]);
      line(c, pts, 0x2a4a1e, 2.2);
      line(c, pts, 0x5a8a3a, 1.2);
      for (let k = 2; k <= 8; k += 2) {
        const [lx, ly] = pts[k];
        if (ly > 54) break;
        const side = k % 4 ? 1 : -1;
        leaf(c, lx, ly, 6 + r() * 2, 2.6, Math.PI / 2 + side * 0.9, side > 0 ? 0x4fa84a : 0x3f8a3a, 0x24481e);
      }
      const [ex, ey] = pts[8];
      if (ey < 52) leaf(c, ex, ey, 7, 3.2, Math.PI / 2 + (r() - 0.5) * 0.6, 0x6abc5a, 0x24481e);
    }
    // a red jungle flower
    for (let i = 0; i < 5; i++) leaf(c, 70, 13, 5, 2.2, (i / 5) * TAU, i % 2 ? 0xe84a5a : 0xc8303a);
    circle(c, 70, 13, 1.3);
    c.fillStyle = css(0xf2d45a);
    c.fill();
  });

  paint(scene, 'canopy-jungle', 180, 110, (c) => {
    crown(c, [[30, 62, 33], [90, 72, 38], [150, 60, 31], [60, 38, 30], [120, 36, 31], [90, 30, 26]], [0x1f4a2a, 0x2f7a3a, 0x5aa84a, 0x9ad06a], 111, 180, 110);
    // big glossy leaves hanging from the bottom
    const r = seeded(112);
    for (let i = 0; i < 9; i++) {
      const x = 20 + i * 17 + r() * 6;
      leaf(c, x, 86 + r() * 8, 14 + r() * 6, 5, Math.PI / 2 + (r() - 0.5) * 0.7, i % 2 ? 0x3f8a3a : 0x2f7a3a, 0x1a3a1a);
    }
  });
}

// ---------- Level 12: Fireworks Pier ----------

function paintPier(scene: Phaser.Scene): void {
  paint(scene, 'crate', 40, 40, (c) => {
    const wood = 0xb08a5a;
    const out = 0x4a3220;
    const r = seeded(120);
    rrect(c, 0.8, 0.8, 38.4, 38.4, 1.5);
    fillOut(c, lin(c, 0, 0, 40, 40, [[0, shade(wood, 0.2)], [0.5, wood], [1, shade(wood, -0.3)]]), out, 1.4);
    // planks
    for (const y of [10.5, 20, 29.5]) {
      line(c, [[3, y], [37, y]], shade(wood, -0.45), 1, 0.8);
      line(c, [[3, y + 1], [37, y + 1]], shade(wood, 0.3), 0.6, 0.5);
    }
    for (let i = 0; i < 16; i++) {
      const y = 3 + r() * 34;
      const x = 5 + r() * 24;
      line(c, [[x, y], [x + 4 + r() * 8, y + (r() - 0.5) * 0.8]], shade(wood, -0.35), 0.6, 0.45);
    }
    // frame and cross brace
    const board = (pts: [number, number][], w: number) => {
      line(c, pts, out, w + 1.6);
      line(c, pts, shade(wood, 0.1), w);
      line(c, pts.map(([x, y]) => [x - 0.6, y - 0.6] as [number, number]), shade(wood, 0.4), w * 0.3, 0.6);
    };
    board([[4.5, 4.5], [35.5, 35.5]], 4.2);
    board([[3.5, 3.5], [36.5, 3.5]], 4);
    board([[3.5, 36.5], [36.5, 36.5]], 4);
    board([[3.5, 3.5], [3.5, 36.5]], 4);
    board([[36.5, 3.5], [36.5, 36.5]], 4);
    for (const [x, y] of [[3.5, 3.5], [36.5, 3.5], [3.5, 36.5], [36.5, 36.5], [20, 20]]) {
      circle(c, x, y, 0.9);
      c.fillStyle = css(0x2a2a2a);
      c.fill();
    }
    // a stencilled star
    c.save();
    c.translate(28, 13);
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k / 10) * TAU;
      const rr = k % 2 ? 2 : 4.5;
      c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
    c.fillStyle = css(0xd6402b, 0.75);
    c.fill();
    c.restore();
    grain(c, 40, 40, 0.07, 0, 121, 64);
  });

  paint(scene, 'barrel', 34, 44, (c) => {
    const wood = 0x9c6b3c;
    const out = 0x3a2414;
    const shape = () => {
      c.beginPath();
      c.moveTo(6, 1);
      c.quadraticCurveTo(17, -0.5, 28, 1);
      c.quadraticCurveTo(35, 22, 28, 43);
      c.quadraticCurveTo(17, 44.5, 6, 43);
      c.quadraticCurveTo(-1, 22, 6, 1);
      c.closePath();
    };
    shape();
    fillOut(c, roundX(c, 0, 34, wood, 0.32, -0.45), out, 1.3);
    c.save();
    shape();
    c.clip();
    // staves bow outward
    for (const k of [-0.66, -0.33, 0, 0.33, 0.66]) {
      const x = 17 + k * 14;
      line(c, [[17 + k * 11, 0], [x + k * 3, 22], [17 + k * 11, 44]], shade(wood, -0.45), 0.8, 0.7);
    }
    // iron hoops
    for (const y of [7, 37, 18, 26]) {
      const big = y === 7 || y === 37;
      c.beginPath();
      c.moveTo(0, y);
      c.quadraticCurveTo(17, y + 2.2, 34, y);
      c.strokeStyle = lin(c, 0, 0, 34, 0, [[0, 0x7a7a84], [0.3, 0xb8b8c4], [1, 0x34343c]]);
      c.lineWidth = big ? 3.2 : 1.8;
      c.stroke();
    }
    c.restore();
    // the lid
    ellipse(c, 17, 1.6, 10.6, 1.4);
    fillOut(c, css(shade(wood, -0.25)), out, 0.8);
    grain(c, 34, 44, 0.06, 0, 123, 64);
  });

  paint(scene, 'banner', 130, 40, (c) => {
    const ropeY = (x: number) => 3 + Math.sin((x / 130) * Math.PI) * 3;
    line(c, Array.from({ length: 14 }, (_, i) => [i * 10, ropeY(i * 10)] as [number, number]), 0x2a2a3a, 1.6);
    const flags = [0xd6402b, 0xf2c14e, 0x2f6fd0, 0x5ab84a, 0xe8507a, 0xf28c3a, 0x7a3ab0];
    for (let k = 0; k < 7; k++) {
      const x0 = 4 + k * 18;
      const y0 = ropeY(x0);
      const y1 = ropeY(x0 + 16);
      const tip: [number, number] = [x0 + 8.5, Math.max(y0, y1) + 34];
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x0 + 16, y1);
      c.quadraticCurveTo(x0 + 12, (y1 + tip[1]) / 2, tip[0], tip[1]);
      c.quadraticCurveTo(x0 + 4, (y0 + tip[1]) / 2, x0, y0);
      c.closePath();
      fillOut(c, lin(c, x0, y0, x0 + 16, tip[1], [[0, shade(flags[k], 0.25)], [0.6, flags[k]], [1, shade(flags[k], -0.3)]]), shade(flags[k], -0.6), 1);
      line(c, [[x0 + 3, y0 + 3], [x0 + 7, y0 + 20]], 0xffffff, 1.2, 0.25);
    }
    // light bulbs between the flags, glowing
    for (let k = 0; k < 8; k++) {
      const x = 2 + k * 18;
      const y = ropeY(x) + 3.5;
      circle(c, x, y, 4.5);
      c.fillStyle = rad(c, x, y, 0.5, x, y, 4.5, [[0, 0xfff2b0, 0.75], [1, 0xffd25a, 0]]);
      c.fill();
      circle(c, x, y, 2.1);
      fillOut(c, rad(c, x - 0.6, y - 0.6, 0.2, x, y, 2.2, [[0, 0xffffff], [0.5, 0xfff0a0], [1, 0xf2b030]]), 0x8a6a20, 0.5);
    }
  });

  paint(scene, 'pier-pole', 5, 90, (c) => {
    c.fillStyle = roundX(c, 0, 5, 0x4a4a6a, 0.4, -0.4);
    c.fillRect(0, 0, 5, 90);
    for (let y = 10; y < 90; y += 16) {
      c.fillStyle = css(0xffffff, 0.5);
      c.fillRect(0, y, 5, 5);
    }
    circle(c, 2.5, 2, 2.4);
    c.fillStyle = css(0xd0c8b0);
    c.fill();
  });
}
