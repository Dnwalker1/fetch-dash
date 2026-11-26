import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, NIGHT } from '../config';
import { blade, circle, css, ellipse, fillOut, grain, leaf, lin, line, paint, rad, roundX, roundY, rrect, seeded, shade, type Ctx } from './paint';

/**
 * Art for the second round of levels (25 November), painted in code. Elon's
 * painted files (26 November, listed in artFiles.ts) replace these; each is
 * painted here only if its file fails to load.
 *
 *   water, water-cap   the water in swimming stretches, and its soft end at the bank
 *   lily, footbridge   things in the water (floating logs and crates reuse log and crate)
 *   splash             one drop of a splash
 *   hz-*               scenery along the sides of the runs into the screen
 *   firefly            Night Woods
 *   moon-*, crater, space-arch, space-pole, moonbug, ufo-0/1, helmet   Moon Run
 */

const TAU = Math.PI * 2;
export const WATER_W = 256;
export const WATER_H = 110;
/** The water's surface line, from the top of the water picture. */
export const WATER_SURFACE = 8;
/** How wide the water's curved end at a bank is. */
export const WATER_CAP_W = 150;

function wrap(x: number, reach: number, w: number, draw: (x: number) => void): void {
  draw(x);
  if (x < reach) draw(x + w);
  if (x > w - reach) draw(x - w);
}

function waterBody(c: Ctx, w: number, alpha: (x: number) => number): void {
  for (let x = 0; x < w; x += 2) {
    const a = alpha(x);
    if (a <= 0) continue;
    c.fillStyle = lin(c, 0, 0, 0, WATER_H, [
      [0, 0xbfe6f2, 0.9 * a],
      [(WATER_SURFACE + 2) / WATER_H, 0x6db6d4, 0.82 * a],
      [0.45, 0x3f8db0, 0.88 * a],
      [1, 0x1d5a78, 0.96 * a],
    ]);
    c.fillRect(x, WATER_SURFACE - 3, 2, WATER_H - WATER_SURFACE + 3);
  }
}

function ripples(c: Ctx, w: number, r: () => number, alpha: (x: number) => number): void {
  // the bright surface line, gently wavy, and glints and ripples below it
  c.beginPath();
  for (let x = 0; x <= w; x += 4) {
    const y = WATER_SURFACE - 2 + Math.sin((x / WATER_W) * TAU * 3) * 1.4;
    if (x === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  }
  c.strokeStyle = css(0xffffff, 0.85);
  c.lineWidth = 2;
  c.save();
  c.globalAlpha = 1;
  c.stroke();
  c.restore();
  for (let i = 0; i < 40; i++) {
    const x = r() * w;
    const y = WATER_SURFACE + 6 + r() * (WATER_H - WATER_SURFACE - 14);
    const len = 8 + r() * 26 * (y / WATER_H + 0.4);
    const a = alpha(x) * (0.18 + r() * 0.25) * (1 - y / WATER_H / 1.3);
    wrap(x, len, w, (px) => line(c, [[px - len / 2, y], [px, y - 1.2], [px + len / 2, y]], 0xffffff, 1.2, a));
  }
}

/** The water strip (tiles sideways) and its soft end where it meets a bank. */
export function paintWater(scene: Phaser.Scene): void {
  paint(scene, 'water', WATER_W, WATER_H, (c) => {
    waterBody(c, WATER_W, () => 1);
    ripples(c, WATER_W, seeded(41), () => 1);
  });
  // left end: the shore curves away from the camera, so the water starts a
  // little farther right the lower down it is, with foam along the edge
  const CAP = WATER_CAP_W;
  const edge = (y: number) => 8 + Math.pow(Math.max(0, y - WATER_SURFACE) / (WATER_H - WATER_SURFACE), 0.8) * (CAP - 40);
  paint(scene, 'water-cap', CAP, WATER_H, (c) => {
    c.save();
    c.beginPath();
    c.moveTo(CAP, 0);
    c.lineTo(edge(0), 0);
    for (let y = 0; y <= WATER_H; y += 4) c.lineTo(edge(y), y);
    c.lineTo(CAP, WATER_H);
    c.closePath();
    c.clip();
    waterBody(c, CAP, () => 1);
    ripples(c, CAP, seeded(42), (x) => Math.min(1, x / CAP + 0.3));
    c.restore();
    // foam where the water laps the shore
    for (let y = WATER_SURFACE - 2; y < WATER_H; y += 5) {
      ellipse(c, edge(y) + 2, y, 4 + (y % 3), 2.4);
      c.fillStyle = css(0xffffff, 0.5 * (1 - y / WATER_H / 1.4));
      c.fill();
    }
  });
  paint(scene, 'splash', 6, 6, (c) => {
    circle(c, 3, 3, 2.6);
    c.fillStyle = rad(c, 2.2, 2.2, 0, 3, 3, 3, [[0, 0xffffff], [1, 0x9fd4ea, 0.7]]);
    c.fill();
  });

  // A lily pad with a pink flower, flat on the water
  paint(scene, 'lily', 54, 18, (c) => {
    c.save();
    c.translate(27, 12);
    c.scale(1, 0.3);
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, 24, 0.25, TAU - 0.15);
    c.closePath();
    fillOut(c, rad(c, -6, -6, 2, 0, 0, 24, [[0, 0x8fd06a], [0.7, 0x4f9a3a], [1, 0x2f6a26]]), 0x1f4a1a, 2);
    for (let k = 0; k < 7; k++) line(c, [[0, 0], [Math.cos(k + 0.6) * 20, Math.sin(k + 0.6) * 20]], 0x9fdc7a, 1.4, 0.5);
    c.restore();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU;
      ellipse(c, 33 + Math.cos(a) * 3.5, 7 + Math.sin(a) * 1.6, 3.6, 2.2, a);
      c.fillStyle = css(k % 2 ? 0xf4a6c6 : 0xfbd0e2);
      c.fill();
    }
    circle(c, 33, 6.5, 1.8);
    c.fillStyle = css(0xf2c84a);
    c.fill();
  });

  // A plank footbridge over the water: dive under it
  paint(scene, 'footbridge', 170, 24, (c) => {
    rrect(c, 2, 8, 166, 12, 3);
    fillOut(c, roundY(c, 8, 20, 0x8a6038), 0x3a2410, 1.6);
    for (let x = 8; x < 166; x += 13) line(c, [[x, 9], [x, 19]], 0x5a3a1c, 1.1, 0.6);
    // the hand rail on top
    line(c, [[4, 4], [166, 4]], 0x6a4426, 3);
    for (const x of [10, 60, 110, 160]) line(c, [[x, 4], [x, 9]], 0x6a4426, 2.4);
    grain(c, 170, 24, 0.08, 0, 6, 170);
  });
}

/** Scenery along the sides of a run into the screen, drawn standing on its bottom edge. */
export function paintHorizonArt(scene: Phaser.Scene): void {
  paint(scene, 'hz-bush', 90, 56, (c) => {
    for (const [x, y, rr] of [[26, 34, 22], [52, 26, 26], [70, 38, 18], [44, 42, 20]] as const) {
      circle(c, x, y, rr);
      fillOut(c, rad(c, x - rr * 0.4, y - rr * 0.5, 2, x, y, rr, [[0, 0x9cd06a], [0.6, 0x5f9a3a], [1, 0x3a6a24]]), 0x2a4a1a, 1.4, 0.6);
    }
  });
  paint(scene, 'hz-flowers', 64, 28, (c) => {
    const r = seeded(5);
    for (let i = 0; i < 26; i++) blade(c, 4 + r() * 56, 28, 8 + r() * 12, (r() - 0.5) * 5, r() < 0.5 ? 0x5f9a3a : 0x7ab44a, 1.4);
    for (let i = 0; i < 9; i++) {
      const x = 6 + r() * 52;
      const y = 6 + r() * 12;
      const col = [0xffffff, 0xf6e27a, 0xf4a6c6, 0xb8a6f0][i % 4];
      for (let k = 0; k < 5; k++) {
        circle(c, x + Math.cos((k / 5) * TAU) * 2.4, y + Math.sin((k / 5) * TAU) * 2.4, 2);
        c.fillStyle = css(col);
        c.fill();
      }
      circle(c, x, y, 1.3);
      c.fillStyle = css(0xf2b82a);
      c.fill();
    }
  });
  paint(scene, 'hz-sunflower', 44, 120, (c) => {
    line(c, [[22, 120], [24, 70], [22, 22]], 0x3f6a20, 3.4);
    leaf(c, 23, 80, 18, 8, -0.4, 0x5a8f2e, 0x3f6a20);
    leaf(c, 22, 58, 16, 7, Math.PI + 0.4, 0x5a8f2e, 0x3f6a20);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * TAU;
      ellipse(c, 22 + Math.cos(a) * 12, 20 + Math.sin(a) * 12, 8, 3.4, a);
      c.fillStyle = css(k % 2 ? 0xf6c42a : 0xffd84a);
      c.fill();
    }
    circle(c, 22, 20, 8);
    c.fillStyle = rad(c, 20, 18, 0, 22, 20, 8, [[0, 0x8a5a2a], [1, 0x4a2a12]]);
    c.fill();
  });
  paint(scene, 'hz-tree', 120, 170, (c) => {
    c.beginPath();
    c.moveTo(54, 170);
    c.lineTo(57, 90);
    c.lineTo(63, 90);
    c.lineTo(68, 170);
    c.closePath();
    fillOut(c, roundX(c, 54, 68, 0x7a5232), 0x3a2414, 1.4);
    for (const [x, y, rr] of [[40, 70, 34], [80, 66, 32], [60, 40, 38], [60, 88, 28]] as const) {
      circle(c, x, y, rr);
      fillOut(c, rad(c, x - rr * 0.4, y - rr * 0.5, 2, x, y, rr, [[0, 0x9cd06a], [0.6, 0x5a9438], [1, 0x356222]]), 0x24461a, 1.4, 0.5);
    }
  });
  paint(scene, 'hz-post', 12, 44, (c) => {
    rrect(c, 2, 2, 8, 42, 2);
    fillOut(c, roundX(c, 2, 10, 0xb08a5a), 0x4a3420, 1.2);
  });
  paint(scene, 'firefly', 8, 8, (c) => {
    circle(c, 4, 4, 4);
    c.fillStyle = rad(c, 4, 4, 0, 4, 4, 4, [[0, 0xfff8c0], [0.35, 0xf6f07a, 0.8], [1, 0xd8f05a, 0]]);
    c.fill();
  });
}

/**
 * The dark over Night Woods, twice the screen's size, with the pet's light cut
 * out of it at its center: a glow around the pet and a beam ahead. It's moved
 * so its center sits on the pet. Painted at 1 pixel per game pixel: it's all
 * soft edges.
 */
export function paintNightLight(scene: Phaser.Scene): string {
  const key = 'night-light';
  if (scene.textures.exists(key)) return key;
  const W = GAME_WIDTH * 2;
  const H = GAME_HEIGHT * 2;
  const tex = scene.textures.createCanvas(key, W, H);
  if (!tex) return key;
  const c = tex.getContext();
  c.fillStyle = css(0x050814, NIGHT.dark);
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'destination-out';
  const cx = GAME_WIDTH;
  const cy = GAME_HEIGHT;
  c.fillStyle = rad(c, cx, cy, 0, cx, cy, NIGHT.radius, [[0, 0x000000, 1], [0.6, 0x000000, 0.85], [1, 0x000000, 0]]);
  c.fillRect(cx - NIGHT.radius, cy - NIGHT.radius, NIGHT.radius * 2, NIGHT.radius * 2);
  // the beam ahead, a little low (it lights the trail)
  c.save();
  c.translate(cx + NIGHT.ahead * 0.5, cy + 6);
  c.scale(1, 0.42);
  const R = NIGHT.ahead * 0.62;
  c.fillStyle = rad(c, -R * 0.35, 0, 0, 0, 0, R, [[0, 0x000000, 0.95], [0.55, 0x000000, 0.7], [1, 0x000000, 0]]);
  c.fillRect(-R, -R, R * 2, R * 2);
  c.restore();
  c.globalCompositeOperation = 'source-over';
  // a warm tint inside the light
  c.fillStyle = rad(c, cx, cy, 0, cx, cy, NIGHT.radius * 1.4, [[0, 0xffd27a, 0.1], [1, 0xffd27a, 0]]);
  c.fillRect(cx - 200, cy - 200, 400, 400);
  tex.refresh();
  return key;
}

/** Everything on the Moon. */
export function paintMoonArt(scene: Phaser.Scene): void {
  const grey = 0xa8a8b8;
  paint(scene, 'moon-rock', 50, 36, (c) => {
    c.beginPath();
    c.moveTo(4, 36);
    c.quadraticCurveTo(2, 18, 14, 10);
    c.quadraticCurveTo(26, 0, 38, 8);
    c.quadraticCurveTo(50, 18, 47, 36);
    c.closePath();
    fillOut(c, rad(c, 18, 10, 2, 26, 22, 30, [[0, shade(grey, 0.4)], [0.6, grey], [1, shade(grey, -0.45)]]), 0x3a3a48, 1.6);
    for (const [x, y, rr] of [[18, 20, 4], [32, 14, 3], [36, 26, 3.5]] as const) {
      ellipse(c, x, y, rr, rr * 0.7);
      c.fillStyle = css(shade(grey, -0.35), 0.6);
      c.fill();
    }
    grain(c, 50, 36, 0.1, 0, 9, 50);
  });
  // a crater across the trail, flat on the ground: jump it like a pond
  paint(scene, 'crater', 100, 24, (c) => {
    ellipse(c, 50, 12, 48, 10);
    c.fillStyle = rad(c, 50, 9, 2, 50, 12, 48, [[0, 0x3a3a4a], [0.7, 0x55556a], [1, shade(grey, 0.2)]]);
    c.fill();
    c.beginPath();
    c.ellipse(50, 12, 48, 10, 0, 0.15, Math.PI - 0.15);
    c.strokeStyle = css(shade(grey, 0.5), 0.9);
    c.lineWidth = 2.4;
    c.stroke();
    c.beginPath();
    c.ellipse(50, 12, 48, 10, 0, Math.PI + 0.2, TAU - 0.2);
    c.strokeStyle = css(0x2a2a38, 0.8);
    c.lineWidth = 2;
    c.stroke();
  });
  paint(scene, 'moon-flag', 36, 62, (c) => {
    line(c, [[8, 62], [8, 4]], 0xd8d8e0, 2.4);
    c.beginPath();
    c.moveTo(9, 6);
    c.lineTo(34, 8);
    c.lineTo(33, 26);
    c.lineTo(9, 24);
    c.closePath();
    fillOut(c, lin(c, 9, 0, 34, 0, [[0, 0xe8c547], [1, 0xc79a3e]]), 0x6a4a1a, 1.2);
    // a paw print on the flag
    for (const [x, y, rr] of [[21, 18, 3.4], [16, 12, 1.6], [20, 10.5, 1.6], [24, 10.5, 1.6], [27, 12.5, 1.6]] as const) {
      circle(c, x, y, rr);
      c.fillStyle = css(0x16202a, 0.85);
      c.fill();
    }
    ellipse(c, 8, 61, 7, 2);
    c.fillStyle = css(0x000000, 0.3);
    c.fill();
  });
  // A solar panel on two legs: slide under it
  paint(scene, 'space-arch', 150, 22, (c) => {
    rrect(c, 2, 4, 146, 14, 3);
    fillOut(c, lin(c, 0, 4, 0, 18, [[0, 0x5a7ad8], [0.5, 0x2a4aa8], [1, 0x1a2a6a]]), 0x0e1640, 1.6);
    for (let x = 14; x < 146; x += 14) line(c, [[x, 5], [x, 17]], 0x9ab4ff, 0.8, 0.6);
    line(c, [[4, 11], [146, 11]], 0x9ab4ff, 0.8, 0.6);
    line(c, [[6, 6], [144, 6]], 0xffffff, 1, 0.5);
  });
  paint(scene, 'space-pole', 8, 90, (c) => {
    rrect(c, 2, 0, 4, 90, 1.5);
    fillOut(c, roundX(c, 2, 6, 0xc8c8d4), 0x4a4a58, 1);
  });
  // A little glowing moon bug that skitters past (the Moon's squirrel)
  paint(scene, 'moonbug', 36, 26, (c) => {
    for (let k = 0; k < 3; k++) line(c, [[10 + k * 7, 18], [6 + k * 8, 25]], 0x3a3a58, 1.6);
    ellipse(c, 18, 14, 13, 8);
    fillOut(c, rad(c, 14, 10, 1, 18, 14, 13, [[0, 0xc8ffd8], [0.5, 0x6ae0a0], [1, 0x2a8a5a]]), 0x1a4a32, 1.4);
    circle(c, 28, 9, 4);
    fillOut(c, rad(c, 27, 8, 0, 28, 9, 4, [[0, 0xc8ffd8], [1, 0x4ac080]]), 0x1a4a32, 1.2);
    line(c, [[29, 5], [32, 1]], 0x3a3a58, 1.2);
    circle(c, 32, 1.5, 1.4);
    c.fillStyle = css(0xffe86a);
    c.fill();
    circle(c, 29.5, 8.5, 1.2);
    c.fillStyle = css(0x16202a);
    c.fill();
  });
  // A flying saucer passing overhead (two frames: its lights blink)
  for (const f of [0, 1]) {
    paint(scene, `ufo-${f}`, 66, 32, (c) => {
      ellipse(c, 33, 12, 12, 10);
      c.fillStyle = rad(c, 30, 8, 1, 33, 12, 12, [[0, 0xe8fbff, 0.95], [1, 0x7ac8e8, 0.6]]);
      c.fill();
      ellipse(c, 33, 19, 31, 8);
      fillOut(c, lin(c, 0, 11, 0, 27, [[0, 0xe0e0ec], [0.5, 0xa8a8bc], [1, 0x5a5a70]]), 0x2a2a3a, 1.4);
      for (let k = 0; k < 5; k++) {
        circle(c, 13 + k * 10, 20, 2.2);
        c.fillStyle = css((k + f) % 2 ? 0xffe86a : 0xff6a8a);
        c.fill();
      }
    });
  }
  // The moon-cheese ball at the end of the trail
  paint(scene, 'moon-ball', 28, 28, (c) => {
    circle(c, 14, 14, 13);
    fillOut(c, rad(c, 10, 9, 1, 14, 14, 14, [[0, 0xfff4b0], [0.55, 0xf6d24a], [1, 0xc8962a]]), 0x8a6418, 1.4);
    for (const [x, y, rr] of [[9, 16, 2.6], [17, 9, 2], [19, 19, 3], [12, 8, 1.4], [22, 13, 1.5]] as const) {
      circle(c, x, y, rr);
      c.fillStyle = rad(c, x - rr * 0.3, y - rr * 0.3, 0, x, y, rr, [[0, 0x9a6a1a], [1, 0xd8a83a]]);
      c.fill();
    }
    ellipse(c, 9.5, 8, 4, 2.4, -0.6);
    c.fillStyle = css(0xffffff, 0.5);
    c.fill();
  });
  // The pet's space helmet: a glass bubble with a rim
  paint(scene, 'helmet', 64, 64, (c) => {
    circle(c, 32, 30, 28);
    c.fillStyle = rad(c, 24, 20, 2, 32, 30, 28, [[0, 0xffffff, 0.12], [0.8, 0xbfe6ff, 0.1], [1, 0xbfe6ff, 0.35]]);
    c.fill();
    c.beginPath();
    c.arc(32, 30, 28, 0, TAU);
    c.strokeStyle = css(0xe8f6ff, 0.75);
    c.lineWidth = 1.6;
    c.stroke();
    // a shine on the glass
    c.beginPath();
    c.arc(32, 30, 22, Math.PI * 1.05, Math.PI * 1.45);
    c.strokeStyle = css(0xffffff, 0.8);
    c.lineWidth = 3;
    c.stroke();
    // the collar ring at the neck
    ellipse(c, 32, 57, 20, 5);
    fillOut(c, lin(c, 0, 52, 0, 62, [[0, 0xf0f0f6], [1, 0x9a9aac]]), 0x4a4a58, 1.2);
  });
}
