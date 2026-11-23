import Phaser from 'phaser';
import type { Theme } from '../levels';
import { blade, circle, css, ellipse, grain, leaf, lin, mix, paint, rad, rrect, seeded, shade, type Ctx } from './paint';

/**
 * The trail's ground, painted once per level as a long strip that repeats
 * every GROUND_TILE pixels. The game lays it down in narrow columns that each
 * sit on the hill under them, so the path and its grass edge follow the hills.
 */

export const GROUND_TILE = 1024;
/** Height of the strip; enough to reach the bottom of the screen from the highest hill. */
export const GROUND_TEX_H = 216;
/**
 * Rows above the ground line: a strip of far verge behind the trail (where the
 * den holes sit), fading into the painted scenery at its top, plus room for
 * grass blades and drifts that stick up.
 */
export const GROUND_TOP = 36;
/** How much of the rows above the line is solid verge (the rest is the fade). */
const VERGE_SOLID = 16;
/** Width of each column the strip is laid down in (narrow, so hills look smooth, not stepped). */
export const GROUND_COL = 4;

const W = GROUND_TILE;
const H = GROUND_TEX_H;
const S = GROUND_TOP;
const TAU = Math.PI * 2;

/** Draws something near the strip's ends again one tile over, so it tiles cleanly. */
function wrapX(x: number, reach: number, draw: (x: number) => void): void {
  draw(x);
  if (x < reach) draw(x + W);
  if (x > W - reach) draw(x - W);
}

/** A gently wobbling line across the strip that still meets itself at the ends. */
function wobble(base: number, a: number, f1: number, f2: number, p: number): (x: number) => number {
  return (x) => base + a * Math.sin((x / W) * TAU * f1 + p) + a * 0.6 * Math.sin((x / W) * TAU * f2 + p * 2.3);
}

/** The path band: [top edge, bottom edge] at x. */
function pathEdges(): [(x: number) => number, (x: number) => number] {
  return [wobble(S + 18, 1.6, 7, 19, 1), wobble(S + 48, 1.5, 5, 23, 2)];
}

function bandPath(c: Ctx, top: (x: number) => number, bot: (x: number) => number): void {
  c.beginPath();
  c.moveTo(0, top(0));
  for (let x = 4; x <= W; x += 4) c.lineTo(x, top(x));
  for (let x = W; x >= 0; x -= 4) c.lineTo(x, bot(x));
  c.closePath();
}

/** A little paw print, for sand and snow paths. */
function pawPrint(c: Ctx, x: number, y: number, s: number, color: number, rim: number): void {
  const spots: [number, number, number, number][] = [[0, 1.4, 2.4, 1.9], [-2.6, -1.6, 0.95, 1.15], [-0.9, -2.9, 0.95, 1.15], [0.9, -2.9, 0.95, 1.15], [2.6, -1.6, 0.95, 1.15]];
  for (const [dx, dy, rx, ry] of spots) {
    ellipse(c, x + dx * s, y + dy * s + 0.6, rx * s, ry * s);
    c.fillStyle = css(rim, 0.45);
    c.fill();
    ellipse(c, x + dx * s, y + dy * s, rx * s, ry * s);
    c.fillStyle = css(color, 0.5);
    c.fill();
  }
}

function pebbles(c: Ctx, r: () => number, n: number, yAt: (x: number) => [number, number], base: number): void {
  for (let i = 0; i < n; i++) {
    const x = r() * W;
    const [y0, y1] = yAt(x);
    const y = y0 + r() * (y1 - y0);
    const rx = 1.1 + r() * 2.2;
    const col = mix(base, 0x8f8a80, r() * 0.6);
    wrapX(x, 6, (px) => {
      ellipse(c, px + 0.6, y + 0.9, rx, rx * 0.7);
      c.fillStyle = css(0x000000, 0.25);
      c.fill();
      ellipse(c, px, y, rx, rx * 0.7);
      c.fillStyle = rad(c, px - rx * 0.4, y - rx * 0.4, 0.2, px, y, rx * 1.1, [[0, shade(col, 0.45)], [0.6, col], [1, shade(col, -0.3)]]);
      c.fill();
    });
  }
}

function paintGrass(c: Ctx, t: Theme): void {
  const r = seeded(11);
  c.fillStyle = lin(c, 0, S, 0, H, [[0, shade(t.grass, 0.1)], [0.3, t.grass], [1, shade(t.grass, -0.24)]]);
  c.fillRect(0, S, W, H - S);

  // the dirt path
  const [top, bot] = pathEdges();
  bandPath(c, top, bot);
  c.fillStyle = lin(c, 0, S + 16, 0, S + 51, [[0, shade(t.dirt, -0.2)], [0.22, shade(t.dirt, 0.08)], [0.7, t.dirt], [1, shade(t.dirt, -0.18)]]);
  c.fill();
  c.save();
  c.clip();
  // the grass edge shades the top of the path; worn ruts run along it
  line(c, (x) => top(x) + 1, 0x000000, 5, 0.16);
  line(c, (x) => S + 29 + Math.sin((x / W) * TAU * 3) * 1.2, shade(t.dirt, -0.14), 3, 0.35);
  line(c, (x) => S + 40 + Math.sin((x / W) * TAU * 4 + 1) * 1.2, shade(t.dirt, -0.14), 3, 0.3);
  line(c, (x) => S + 37 + Math.sin((x / W) * TAU * 4 + 1) * 1.2, shade(t.dirt, 0.15), 1.5, 0.35);
  c.restore();
  pebbles(c, r, 80, (x) => [top(x) + 4, bot(x) - 3], t.dirtDark);
  pebbles(c, r, 30, () => [S + 58, H - 8], shade(t.grassDark, -0.1));

  grain(c, W, H, 0.05, 0.07, 3);

  // grass fringe over the path's edges
  for (let x = 0; x < W; x += 2.2 + r() * 2) {
    const g = r() < 0.5 ? t.grassDark : t.grass;
    wrapX(x, 4, (px) => {
      blade(c, px, top(px) - 2, -(2 + r() * 4), (r() - 0.5) * 3, g, 1.2);
      blade(c, px + 1, bot(px) + 2, 2 + r() * 4, (r() - 0.5) * 3, g, 1.2);
    });
  }
  // tufts, flowers or fallen leaves on the lower grass
  for (let i = 0; i < 70; i++) {
    const x = r() * W;
    const y = S + 58 + r() * (H - S - 66);
    const n = 3 + Math.floor(r() * 4);
    wrapX(x, 10, (px) => {
      for (let k = 0; k < n; k++) blade(c, px + (k - n / 2) * 1.6, y, 4 + r() * 6, (k - n / 2) * 1.2 + (r() - 0.5) * 2, k % 2 ? t.grassDark : shade(t.grass, -0.12), 1.2);
    });
  }
  if (t.speckle !== undefined) {
    for (let i = 0; i < 150; i++) {
      const x = r() * W;
      const y = S + 4 + r() * (H - S - 8);
      const col = shade(t.speckle, (r() - 0.5) * 0.4);
      wrapX(x, 6, (px) => leaf(c, px, y, 3 + r() * 2.5, 1.4 + r(), r() * TAU, col));
    }
  } else {
    for (let i = 0; i < 26; i++) {
      const x = r() * W;
      const y = S + 60 + r() * (H - S - 70);
      const col = r() < 0.6 ? 0xfdf8e8 : 0xf6d04d;
      wrapX(x, 8, (px) => {
        for (let k = 0; k < 2 + Math.floor(r() * 2); k++) {
          const fx = px + (r() - 0.5) * 8;
          const fy = y + (r() - 0.5) * 5;
          for (let p = 0; p < 5; p++) {
            circle(c, fx + Math.cos((p / 5) * TAU) * 1.3, fy + Math.sin((p / 5) * TAU) * 1.3, 1);
            c.fillStyle = css(col);
            c.fill();
          }
          circle(c, fx, fy, 0.8);
          c.fillStyle = css(0xe0a020);
          c.fill();
        }
      });
    }
  }

  // shadow under the grass lip, then the blades along the top edge
  c.fillStyle = lin(c, 0, S, 0, S + 8, [[0, shade(t.grassDark, -0.2), 0.55], [1, t.grassDark, 0]]);
  c.fillRect(0, S, W, 8);
  const greens = [t.grassDark, shade(t.grassDark, -0.15), t.grass, shade(t.grass, 0.18)];
  for (let x = 0; x < W; x += 1.3 + r() * 1.4) {
    const h = 3 + r() * 8;
    const col = greens[Math.floor(r() * greens.length)];
    const lean = (r() - 0.5) * 5;
    const y = S + 3 + r() * 2;
    wrapX(x, 6, (px) => blade(c, px, y, h, lean, col, 1.3));
  }
}

function paintSand(c: Ctx, t: Theme): void {
  const r = seeded(21);
  c.fillStyle = lin(c, 0, S, 0, H, [[0, shade(t.grass, 0.12)], [0.3, t.grass], [1, shade(t.grass, -0.14)]]);
  c.fillRect(0, S, W, H - S);

  // packed sand where the path runs, with paw prints along it
  const [top, bot] = pathEdges();
  bandPath(c, top, bot);
  c.fillStyle = lin(c, 0, S + 16, 0, S + 51, [[0, t.dirt, 0.2], [0.2, t.dirt, 0.85], [0.8, t.dirt, 0.85], [1, t.dirt, 0.25]]);
  c.fill();
  for (let x = 30; x < W; x += 64) {
    const up = (x / 64) % 2 === 0;
    pawPrint(c, x, up ? S + 28 : S + 38, 1.15, shade(t.dirt, -0.3), shade(t.dirt, 0.25));
  }

  // wind ripples in the loose sand
  for (let y0 = S + 58; y0 < H - 4; y0 += 8 + r() * 4) {
    let x = r() * 60;
    while (x < W) {
      const len = 40 + r() * 110;
      const ph = r() * TAU;
      const seg = (dy: number): [number, number][] => {
        const pts: [number, number][] = [];
        for (let k = 0; k <= len; k += 4) pts.push([x + k, y0 + dy + Math.sin((x + k) / 23 + ph) * 2]);
        return pts;
      };
      for (const off of [0, -W]) {
        const shift = (p: [number, number][]) => p.map(([a, b]) => [a + off, b] as [number, number]);
        line(c, shift(seg(0)), shade(t.grass, -0.16), 1.4, 0.55);
        line(c, shift(seg(-1.6)), shade(t.grass, 0.2), 1, 0.5);
      }
      x += len + 20 + r() * 60;
    }
  }
  pebbles(c, r, 25, () => [S + 56, H - 8], shade(t.dirtDark, -0.1));
  grain(c, W, H, 0.1, 0.05, 5);

  // shells
  const shells = [0xfbe9dc, 0xf6c9b6, 0xfff4e0, 0xe9b8a8];
  for (let i = 0; i < 22; i++) {
    const x = r() * W;
    const y = S + 6 + r() * (H - S - 14);
    const col = shells[i % shells.length];
    const s = 2.2 + r() * 1.8;
    const a = (r() - 0.5) * 1.2;
    wrapX(x, 6, (px) => {
      c.save();
      c.translate(px, y);
      c.rotate(a);
      c.beginPath();
      c.moveTo(0, s * 0.6);
      c.arc(0, s * 0.2, s, Math.PI * 1.05, Math.PI * 1.95);
      c.closePath();
      c.fillStyle = lin(c, 0, -s, 0, s, [[0, shade(col, 0.3)], [1, shade(col, -0.2)]]);
      c.fill();
      c.strokeStyle = css(shade(col, -0.4), 0.8);
      c.lineWidth = 0.6;
      c.stroke();
      for (let k = -2; k <= 2; k++) line(c, [[0, s * 0.5], [k * s * 0.35, -s * 0.6]], shade(col, -0.3), 0.5, 0.6);
      c.restore();
    });
  }
  // a soft crest along the top, and a few tufts of dune grass
  c.fillStyle = lin(c, 0, S - 1, 0, S + 6, [[0, shade(t.grass, 0.25)], [1, t.grass, 0]]);
  for (let x = 0; x < W; x += 30 + r() * 30) {
    const w = 20 + r() * 30;
    wrapX(x, 40, (px) => {
      ellipse(c, px, S + 1, w, 2.2);
      c.fill();
    });
  }
  for (let i = 0; i < 9; i++) {
    const x = r() * W;
    wrapX(x, 12, (px) => {
      for (let k = 0; k < 7; k++) blade(c, px + (k - 3) * 1.3, S + 3, 6 + r() * 9, (k - 3) * 1.6, k % 2 ? 0x8f8a46 : 0xa8a058, 1.1);
    });
  }
}

function paintSnow(c: Ctx, t: Theme): void {
  const r = seeded(31);
  c.fillStyle = lin(c, 0, S, 0, H, [[0, shade(t.grass, 0.35)], [0.25, t.grass], [1, mix(t.grass, t.dirtDark, 0.55)]]);
  c.fillRect(0, S, W, H - S);

  // trodden snow on the path, with paw prints
  const [top, bot] = pathEdges();
  bandPath(c, top, bot);
  c.fillStyle = lin(c, 0, S + 16, 0, S + 51, [[0, t.dirt, 0.4], [0.25, t.dirt, 0.95], [0.8, t.dirt, 0.95], [1, t.dirt, 0.4]]);
  c.fill();
  line(c, (x) => top(x) + 1.5, 0xffffff, 1.6, 0.6);
  for (let x = 20; x < W; x += 64) pawPrint(c, x, (x / 64) % 2 ? S + 37 : S + 28, 1.15, t.dirtDark, 0xffffff);

  // soft drifts with blue shadows underneath
  for (let i = 0; i < 40; i++) {
    const x = r() * W;
    const y = S + 58 + r() * (H - S - 64);
    const w = 12 + r() * 26;
    wrapX(x, 40, (px) => {
      ellipse(c, px + 2, y + 2.5, w, 3.5);
      c.fillStyle = css(t.dirtDark, 0.22);
      c.fill();
      ellipse(c, px, y, w, 3.2);
      c.fillStyle = css(0xffffff, 0.55);
      c.fill();
    });
  }
  grain(c, W, H, 0.02, 0.05, 9);

  // rounded drifts along the top edge
  for (let x = 0; x < W; x += 14 + r() * 22) {
    const w = 10 + r() * 16;
    const h = 2.5 + r() * 3.5;
    wrapX(x, 30, (px) => {
      ellipse(c, px, S + 2, w, h);
      c.fillStyle = lin(c, 0, S + 2 - h, 0, S + 2 + h, [[0, 0xffffff], [0.7, shade(t.grass, 0.2)], [1, t.grassDark]]);
      c.fill();
    });
  }
  // sparkles
  for (let i = 0; i < 160; i++) {
    const x = r() * W;
    const y = S + 2 + r() * (H - S - 4);
    circle(c, x, y, 0.5 + r() * 0.7);
    c.fillStyle = css(0xffffff, 0.6 + r() * 0.4);
    c.fill();
  }
  for (let i = 0; i < 22; i++) {
    const x = 4 + r() * (W - 8);
    const y = S + 6 + r() * (H - S - 10);
    const s = 1.6 + r() * 1.6;
    line(c, [[x - s, y], [x + s, y]], 0xffffff, 0.8, 0.9);
    line(c, [[x, y - s], [x, y + s]], 0xffffff, 0.8, 0.9);
  }
}

function paintStreet(c: Ctx, t: Theme): void {
  const r = seeded(41);
  // the road first
  c.fillStyle = lin(c, 0, S + 30, 0, H, [[0, shade(t.dirt, -0.15)], [0.2, t.dirt], [1, shade(t.dirt, -0.12)]]);
  c.fillRect(0, S + 30, W, H - S - 30);
  for (let i = 0; i < 900; i++) {
    circle(c, r() * W, S + 31 + r() * (H - S - 32), 0.4 + r() * 0.7);
    c.fillStyle = css(r() < 0.5 ? 0xffffff : 0x000000, 0.12 + r() * 0.12);
    c.fill();
  }
  for (let i = 0; i < 7; i++) {
    const x = r() * W;
    wrapX(x, 30, (px) => {
      ellipse(c, px, S + 80 + r() * 60, 10 + r() * 16, 3 + r() * 3);
      c.fillStyle = css(0x000000, 0.12);
      c.fill();
    });
  }
  // lane dashes, a little worn
  for (let x = 20; x < W; x += 128) {
    rrect(c, x, S + 64, 56, 5, 2);
    c.fillStyle = lin(c, 0, S + 64, 0, S + 69, [[0, shade(t.dirtDark, 0.2)], [1, shade(t.dirtDark, -0.12)]]);
    c.fill();
  }
  // the sidewalk: slabs with seams, a lit top edge, the odd crack and weed
  for (let x = 0; x < W; x += 64) {
    const col = shade(t.grass, (r() - 0.5) * 0.09);
    c.fillStyle = lin(c, 0, S, 0, S + 24, [[0, shade(col, 0.12)], [1, shade(col, -0.08)]]);
    c.fillRect(x, S, 64, 24);
  }
  c.fillStyle = lin(c, 0, S, 0, S + 4, [[0, mix(t.grass, 0xffffff, 0.45)], [1, t.grass, 0]]);
  c.fillRect(0, S, W, 4);
  grain(c, W, H, 0.07, 0.04, 13);
  for (let x = 0; x < W; x += 64) {
    line(c, [[x + 0.5, S + 3], [x + 0.5, S + 24]], shade(t.grass, -0.4), 1.5, 0.8);
    line(c, [[x + 2, S + 3], [x + 2, S + 24]], shade(t.grass, 0.3), 1, 0.5);
    if (r() < 0.35) {
      const cx = x + 10 + r() * 40;
      line(c, [[cx, S + 4], [cx + 3, S + 10], [cx + 1, S + 16], [cx + 5, S + 23]], shade(t.grass, -0.35), 0.8, 0.7);
    }
    if (r() < 0.3) for (let k = 0; k < 4; k++) blade(c, x + 1 + (k - 1.5), S + 24, 3 + r() * 4, (k - 1.5) * 1.5, 0x5f8a3a, 1);
  }
  // the curb and its shadow on the road
  c.fillStyle = lin(c, 0, S + 24, 0, S + 30, [[0, shade(t.grassDark, 0.4)], [0.3, t.grassDark], [1, shade(t.grassDark, -0.35)]]);
  c.fillRect(0, S + 24, W, 6);
  c.fillStyle = lin(c, 0, S + 30, 0, S + 38, [[0, 0x000000, 0.4], [1, 0x000000, 0]]);
  c.fillRect(0, S + 30, W, 8);
  // storm drains
  for (const x of [300, 812]) {
    rrect(c, x, S + 31, 40, 5, 1.5);
    c.fillStyle = css(0x2f3135);
    c.fill();
    for (let k = 0; k < 8; k++) line(c, [[x + 4 + k * 4.5, S + 32], [x + 4 + k * 4.5, S + 35]], 0x6a6d74, 1.2, 0.9);
  }
}

function paintBoards(c: Ctx, t: Theme): void {
  const r = seeded(51);
  // dark water under the pier, with the fireworks' glints on it
  c.fillStyle = lin(c, 0, S + 22, 0, H, [[0, shade(t.dirt, -0.35)], [1, t.dirt]]);
  c.fillRect(0, S + 22, W, H - S - 22);
  for (let i = 0; i < 70; i++) {
    const x = r() * W;
    const y = S + 34 + r() * (H - S - 40);
    const w = 6 + r() * 26;
    wrapX(x, 30, (px) => line(c, [[px, y], [px + w, y]], r() < 0.4 ? t.dirtDark : 0xffffff, 1 + r(), 0.25 + r() * 0.5));
  }
  // posts going down into the water
  for (let x = 40; x < W; x += 128) {
    c.fillStyle = lin(c, x, 0, x + 12, 0, [[0, shade(0x4a3a2a, 0.25)], [0.4, 0x4a3a2a], [1, shade(0x4a3a2a, -0.45)]]);
    c.fillRect(x, S + 22, 12, H - S - 22);
    ellipse(c, x + 6, S + 52, 10, 2);
    c.fillStyle = css(0xffffff, 0.18);
    c.fill();
  }
  // the deck: planks with their ends, grain and nails
  for (let x = 0; x < W; x += 32) {
    const col = shade(t.grass, (r() - 0.5) * 0.14);
    c.fillStyle = lin(c, 0, S, 0, S + 22, [[0, shade(col, 0.12)], [1, shade(col, -0.15)]]);
    c.fillRect(x, S, 32, 22);
    for (let k = 0; k < 3; k++) {
      const y = S + 5 + k * 5 + r() * 3;
      line(c, [[x + 3, y], [x + 12, y + 0.6], [x + 22, y - 0.4], [x + 30, y + 0.3]], shade(col, -0.3), 0.7, 0.45);
    }
    line(c, [[x + 0.5, S + 3], [x + 0.5, S + 20]], shade(t.grassDark, -0.2), 1.5, 0.9);
    for (const ny of [S + 6, S + 15]) {
      circle(c, x + 4, ny, 0.9);
      c.fillStyle = css(0x2a2018, 0.8);
      c.fill();
    }
  }
  c.fillStyle = lin(c, 0, S, 0, S + 3, [[0, 0xe0bd8c], [1, 0xc8a274, 0.6]]);
  c.fillRect(0, S, W, 3);
  c.fillStyle = lin(c, 0, S + 20, 0, S + 25, [[0, shade(t.grassDark, 0.15)], [1, shade(t.grassDark, -0.4)]]);
  c.fillRect(0, S + 20, W, 5);
  grain(c, W, H, 0.05, 0.03, 17);
}

/** A wobbly line across the whole strip (pts as a function of x), or a list of points. */
function line(c: Ctx, pts: [number, number][] | ((x: number) => number), color: number, lw: number, alpha = 1): void {
  c.beginPath();
  if (typeof pts === 'function') {
    for (let x = -4; x <= W + 4; x += 4) (x === -4 ? c.moveTo(x, pts(x)) : c.lineTo(x, pts(x)));
  } else {
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  }
  c.strokeStyle = css(color, alpha);
  c.lineWidth = lw;
  c.stroke();
}

/** Paints the level's ground strip (once) and cuts it into columns. Returns its texture key. */
/**
 * The far verge just behind the trail: grass (or sand, or snow) with a little
 * earth showing through, fading out at the top so there's no hard line
 * against the painted scenery. The street and the pier have none.
 */
function paintVerge(c: Ctx, t: Theme): void {
  if (t.tufts === 'street' || t.tufts === 'boards') return;
  const top = S - VERGE_SOLID;
  const base = t.tufts === 'snow' ? shade(t.grass, 0.3) : t.grass;
  // a soft fade in, then solid down to the ground line
  c.fillStyle = lin(c, 0, 0, 0, S + 2, [[0, base, 0], [(top - 2) / (S + 2), base, 0.85], [1, shade(base, -0.08)]]);
  c.fillRect(0, 0, W, S + 2);
  const r = seeded(77);
  // patches of earth showing through, and darker tufts
  for (let i = 0; i < 70; i++) {
    const x = r() * W;
    const y = top + 2 + r() * (VERGE_SOLID - 2);
    const rx = 4 + r() * 10;
    wrapX(x, rx + 2, (px) => {
      ellipse(c, px, y, rx, 1.4 + r() * 1.6);
      c.fillStyle = css(r() < 0.55 ? t.dirt : t.grassDark, 0.28 + r() * 0.2);
      c.fill();
    });
  }
  if (t.tufts === 'grass') {
    for (let i = 0; i < 260; i++) {
      const x = r() * W;
      const y = top + 3 + r() * (VERGE_SOLID + 2);
      wrapX(x, 4, (px) => blade(c, px, y, 2 + r() * 4, (r() - 0.5) * 3, r() < 0.5 ? t.grassDark : shade(t.grass, 0.12), 1, 0.8));
    }
  }
}

export function paintGround(scene: Phaser.Scene, levelId: number, t: Theme): string {
  const key = `ground-${levelId}`;
  const tex = paint(scene, key, W, H, (c) => {
    paintVerge(c, t);
    if (t.tufts === 'sand') paintSand(c, t);
    else if (t.tufts === 'snow') paintSnow(c, t);
    else if (t.tufts === 'street') paintStreet(c, t);
    else if (t.tufts === 'boards') paintBoards(c, t);
    else paintGrass(c, t);
  });
  if (tex) {
    // columns in canvas pixels (the canvas is painted at the render scale)
    const res = (tex.customData as { res?: number }).res ?? 1;
    for (let i = 0; i < W / GROUND_COL; i++) tex.add(i, 0, i * GROUND_COL * res, 0, GROUND_COL * res, H * res);
  }
  return key;
}
