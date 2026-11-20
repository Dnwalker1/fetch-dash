import Phaser from 'phaser';
import { BONUS, GAME_WIDTH } from '../config';
import { blade, circle, css, ellipse, fillOut, grain, lin, line, paint, rad, roundX, roundY, rrect, seeded, shade, type Ctx } from './paint';
import { crown } from './props';

/**
 * Placeholder art for the Backyard Toss bonus round, painted in code. Each
 * key can be swapped for a painted picture at twice the size given here (see
 * the list at the top of src/scenes/BonusScene.ts).
 */

const TAU = Math.PI * 2;
const CX = GAME_WIDTH / 2;
/** Where the lawn texture starts on screen. */
export const LAWN_TOP = 118;
const LAWN_H = 540 - LAWN_TOP;

/** Size of things at a screen height, for painting (the same rule the scene uses). */
function depthAt(y: number): number {
  const t = Math.max(0, Math.min(1, (y - BONUS.horizonY) / (540 - BONUS.horizonY)));
  return BONUS.farScale + (BONUS.nearScale - BONUS.farScale) * t;
}

/** Half the lawn's width at a screen height. */
export function halfWidthAt(y: number): number {
  const t = (y - BONUS.fenceY) / (540 - BONUS.fenceY);
  return BONUS.halfWidthFar + (BONUS.halfWidthNear - BONUS.halfWidthFar) * t;
}

export function paintBonusArt(scene: Phaser.Scene): void {
  paintSky(scene);
  paintLawn(scene);
  paintHedge(scene);
  paintRing(scene);
  paintPiles(scene);
  paintYarn(scene);
  paintSprinkler(scene);
  paintShadow(scene);
}

// ---------- Sky, far trees and the back fence ----------

function paintSky(scene: Phaser.Scene): void {
  const W = GAME_WIDTH;
  const H = 140;
  paint(scene, 'toss-sky', W, H, (c) => {
    c.fillStyle = lin(c, 0, 0, 0, BONUS.horizonY, [[0, 0x6fb8ef], [1, 0xd4efff]]);
    c.fillRect(0, 0, W, BONUS.horizonY + 2);
    const r = seeded(31);
    // soft clouds
    for (const [x, y, s] of [[150, 34, 1], [430, 22, 0.8], [720, 44, 1.1], [880, 18, 0.7]]) {
      for (let i = 0; i < 6; i++) {
        ellipse(c, x + (i - 2.5) * 16 * s, y + (r() - 0.5) * 6, (16 + r() * 10) * s, (9 + r() * 5) * s);
        c.fillStyle = css(0xffffff, 0.55);
        c.fill();
      }
    }
    // far hills in the haze
    const hills = (base: number, amp: number, col: number, seed: number) => {
      const hr = seeded(seed);
      const ph = hr() * TAU;
      c.beginPath();
      c.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) c.lineTo(x, base - amp * (0.5 + 0.5 * Math.sin(x / 140 + ph)) - amp * 0.4 * Math.sin(x / 61 + ph * 2));
      c.lineTo(W, H);
      c.closePath();
      c.fillStyle = css(col);
      c.fill();
    };
    hills(98, 16, 0xa9cfa4, 4);
    hills(110, 12, 0x8dbd84, 9);
    // a row of small, far trees behind the fence
    for (let x = -10; x < W + 20; x += 34 + r() * 30) {
      const s = 0.7 + r() * 0.5;
      const base = 126;
      rrect(c, x - 1.6 * s, base - 14 * s, 3.2 * s, 14 * s, 1);
      c.fillStyle = css(0x6b4a2e);
      c.fill();
      const puffs: [number, number, number][] = [[x, base - 22 * s, 11 * s], [x - 8 * s, base - 16 * s, 8 * s], [x + 8 * s, base - 17 * s, 8 * s]];
      for (const [px, py, pr] of puffs) {
        circle(c, px, py, pr);
        c.fillStyle = rad(c, px - pr * 0.4, py - pr * 0.5, 1, px, py, pr, [[0, 0x8fc46a], [0.6, 0x5f9a46], [1, 0x467a36]]);
        c.fill();
      }
    }
    // the back fence: white pickets across the whole yard
    const top = 113;
    const base = BONUS.fenceY + 2;
    for (const y of [117, 126]) {
      c.fillStyle = lin(c, 0, y, 0, y + 3, [[0, 0xfffaf0], [1, 0xc9bea8]]);
      c.fillRect(0, y, W, 3);
    }
    for (let x = 2; x < W; x += 9) {
      c.beginPath();
      c.moveTo(x, base);
      c.lineTo(x, top + 2.5);
      c.lineTo(x + 2.5, top);
      c.lineTo(x + 5, top + 2.5);
      c.lineTo(x + 5, base);
      c.closePath();
      fillOut(c, roundX(c, x, x + 5, 0xf4ecdc, 0.2, -0.25), 0x8f8470, 0.7);
    }
    c.fillStyle = css(0x4d7a34, 0.35);
    c.fillRect(0, base - 3, W, 3);
  });
}

// ---------- The lawn ----------

function paintLawn(scene: Phaser.Scene): void {
  const W = GAME_WIDTH;
  const H = LAWN_H;
  paint(scene, 'toss-lawn', W, H, (c) => {
    const top = BONUS.fenceY - LAWN_TOP;
    const edge = (y: number) => halfWidthAt(y + LAWN_TOP);
    const shape = () => {
      c.beginPath();
      c.moveTo(CX - edge(top), top);
      c.lineTo(CX + edge(top), top);
      c.lineTo(CX + edge(H), H);
      c.lineTo(CX - edge(H), H);
      c.closePath();
    };
    shape();
    c.fillStyle = lin(c, 0, top, 0, H, [[0, 0x9fcc62], [0.35, 0x78b246], [1, 0x4f9433]]);
    c.fill();
    c.save();
    shape();
    c.clip();
    // Mowing stripes that run away from you (along the lawn's sides)...
    const vpY = top - (BONUS.halfWidthFar * (540 - BONUS.fenceY)) / (BONUS.halfWidthNear - BONUS.halfWidthFar);
    const n = 14;
    const x0 = CX - edge(H);
    const x1 = CX + edge(H);
    for (let i = 0; i < n; i += 2) {
      const a = x0 + ((x1 - x0) * i) / n;
      const b = x0 + ((x1 - x0) * (i + 1)) / n;
      c.beginPath();
      c.moveTo(CX, vpY);
      c.lineTo(a, H);
      c.lineTo(b, H);
      c.closePath();
      c.fillStyle = css(0xffffff, 0.07);
      c.fill();
    }
    // ...and bands across that get closer together far away
    let y = top;
    let k = 0;
    while (y < H) {
      const step = 30 * depthAt(y + LAWN_TOP);
      if (k++ % 2 === 0) {
        c.fillStyle = css(0x1f4a10, 0.06);
        c.fillRect(0, y, W, step);
      }
      y += step;
    }
    // grass blades, smaller in the distance
    const r = seeded(77);
    const greens = [0x3f7f2a, 0x5c9a38, 0x8cc456, 0xa9d46a];
    for (let i = 0; i < 2600; i++) {
      const gy = top + Math.pow(r(), 0.8) * (H - top);
      const hw = edge(gy);
      const gx = CX + (r() * 2 - 1) * hw;
      const d = depthAt(gy + LAWN_TOP);
      blade(c, gx, gy, (3 + r() * 4) * d, (r() - 0.5) * 3 * d, greens[Math.floor(r() * greens.length)], 0.8 * d, 0.55);
    }
    // little flowers here and there
    for (let i = 0; i < 70; i++) {
      const gy = top + 10 + r() * (H - top - 10);
      const hw = edge(gy);
      const side = r() < 0.5 ? -1 : 1;
      const gx = CX + side * hw * (0.55 + r() * 0.42);
      const d = depthAt(gy + LAWN_TOP);
      const col = [0xffffff, 0xfff27a, 0xffc4dd][i % 3];
      for (let p = 0; p < 4; p++) {
        circle(c, gx + Math.cos((p * TAU) / 4) * 1.4 * d, gy + Math.sin((p * TAU) / 4) * 0.9 * d, 1.2 * d);
        c.fillStyle = css(col, 0.9);
        c.fill();
      }
      circle(c, gx, gy, 0.8 * d);
      c.fillStyle = css(0xf2b43a);
      c.fill();
    }
    // shade under the hedges along both sides, and under the back fence
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(CX + side * edge(top), top);
      c.lineTo(CX + side * edge(H), H);
      c.lineTo(CX + side * (edge(H) - 70), H);
      c.lineTo(CX + side * (edge(top) - 22), top);
      c.closePath();
      c.fillStyle = lin(c, CX + side * edge(H), 0, CX + side * (edge(H) - 70), 0, [[0, 0x183c10, 0.32], [1, 0x183c10, 0]]);
      c.fill();
    }
    c.fillStyle = lin(c, 0, top, 0, top + 14, [[0, 0x183c10, 0.3], [1, 0x183c10, 0]]);
    c.fillRect(0, top, W, 14);
    c.restore();
    grain(c, W, H, 0.05, 0.08, 12, 1024);
  });
}

// ---------- Garden border along the side of the lawn (left; flipped for the right) ----------

export const HEDGE_W = 300;

function paintHedge(scene: Phaser.Scene): void {
  const W = HEDGE_W;
  const H = LAWN_H;
  paint(scene, 'toss-hedge', W, H, (c) => {
    const top = BONUS.fenceY - LAWN_TOP;
    const edgeX = (y: number) => CX - halfWidthAt(y + LAWN_TOP);
    // the ground beyond the lawn: darker grass
    c.beginPath();
    c.moveTo(0, top);
    c.lineTo(edgeX(top), top);
    c.lineTo(edgeX(H), H);
    c.lineTo(0, H);
    c.closePath();
    c.fillStyle = lin(c, 0, top, 0, H, [[0, 0x5c8f3e], [1, 0x356b25]]);
    c.fill();
    // bushes along the edge, small and far at the top, big and near at the bottom
    const r = seeded(55);
    const greens: [number, number, number, number] = [0x2c5e22, 0x3f7f2c, 0x67a345, 0x8cc25c];
    const flowers = [0xf06a8c, 0xffd23f, 0xffffff, 0xb07de8];
    let y = top + 2;
    while (y < H + 20) {
      const d = depthAt(y + LAWN_TOP);
      const x = edgeX(y) - 6 * d;
      const s = 22 * d;
      const puffs: [number, number, number][] = [
        [x - s * 0.9, y - s * 0.8, s * 0.75],
        [x - s * 0.1, y - s * 0.95, s * 0.8],
        [x + s * 0.2, y - s * 0.45, s * 0.55],
        [x - s * 1.6, y - s * 0.55, s * 0.7],
      ];
      crown(c, puffs, greens, Math.floor(r() * 1000), W, H);
      if (r() < 0.55) {
        for (let i = 0; i < 6; i++) {
          const [px, py, pr] = puffs[Math.floor(r() * puffs.length)];
          circle(c, px + (r() - 0.5) * pr, py + (r() - 0.5) * pr * 0.8, 1.6 * d);
          c.fillStyle = css(flowers[(i + Math.floor(y)) % flowers.length]);
          c.fill();
        }
      }
      y += 18 * d;
    }
    grain(c, W, H, 0.05, 0, 13, 320);
  });
}

// ---------- The glowing spot to bring the ball back to ----------

function paintRing(scene: Phaser.Scene): void {
  const { rx, ry } = BONUS.ring;
  const W = rx * 2 + 20;
  const H = ry * 2 + 16;
  paint(scene, 'toss-ring', W, H, (c) => {
    const cx = W / 2;
    const cy = H / 2;
    c.save();
    c.translate(cx, cy);
    c.scale(1, ry / rx);
    circle(c, 0, 0, rx + 8);
    c.fillStyle = rad(c, 0, 0, rx - 14, 0, 0, rx + 8, [[0, 0xfff2a8, 0], [0.55, 0xffe37a, 0.5], [0.8, 0xffd23f, 0.35], [1, 0xffd23f, 0]]);
    c.fill();
    circle(c, 0, 0, rx);
    c.strokeStyle = css(0xfff7cf, 0.95);
    c.lineWidth = 4;
    c.stroke();
    circle(c, 0, 0, rx - 5);
    c.strokeStyle = css(0xe0a92a, 0.8);
    c.lineWidth = 2;
    c.setLineDash([8, 7]);
    c.stroke();
    c.restore();
  });
}

// ---------- Golden treat piles ----------

function paintPiles(scene: Phaser.Scene): void {
  const gold = 0xf5c542;
  paint(scene, 'toss-pile', 36, 22, (c) => {
    ellipse(c, 18, 19, 16, 3.5);
    c.fillStyle = css(0x000000, 0.18);
    c.fill();
    for (const [x, y, a] of [[11, 15, -0.25], [24, 15, 0.3], [17, 9, 0.05]]) {
      c.save();
      c.translate(x, y);
      c.rotate(a);
      c.beginPath();
      c.rect(-6, -2, 12, 4);
      for (const [bx, by] of [[-6.5, -2], [-6.5, 2], [6.5, -2], [6.5, 2]]) {
        c.moveTo(bx + 2.6, by);
        c.arc(bx, by, 2.6, 0, TAU);
      }
      fillOut(c, roundY(c, -5, 5, gold, 0.45, -0.35), 0x9a6a12, 1);
      c.restore();
    }
    for (const [x, y] of [[8, 4], [29, 6], [20, 2]]) sparkle(c, x, y, 2.4);
  });
  paint(scene, 'toss-pile-cat', 36, 22, (c) => {
    ellipse(c, 18, 19, 16, 3.5);
    c.fillStyle = css(0x000000, 0.18);
    c.fill();
    for (const [x, y, a, f] of [[12, 15, -0.15, 1], [24, 15, 0.2, -1], [18, 9, 0, 1]]) {
      c.save();
      c.translate(x, y);
      c.rotate(a);
      c.scale(f, 1);
      c.beginPath();
      c.moveTo(-8, 0);
      c.quadraticCurveTo(-2, -4.5, 4, -1.2);
      c.lineTo(8, -3.5);
      c.lineTo(7, 0);
      c.lineTo(8, 3.5);
      c.lineTo(4, 1.2);
      c.quadraticCurveTo(-2, 4.5, -8, 0);
      c.closePath();
      fillOut(c, roundY(c, -4, 4, gold, 0.45, -0.35), 0x9a6a12, 1);
      circle(c, -5, -0.6, 0.8);
      c.fillStyle = css(0x3a2a10);
      c.fill();
      c.restore();
    }
    for (const [x, y] of [[8, 4], [29, 6], [20, 2]]) sparkle(c, x, y, 2.4);
  });
}

function sparkle(c: Ctx, x: number, y: number, s: number): void {
  c.beginPath();
  c.moveTo(x, y - s);
  c.lineTo(x + s * 0.3, y - s * 0.3);
  c.lineTo(x + s, y);
  c.lineTo(x + s * 0.3, y + s * 0.3);
  c.lineTo(x, y + s);
  c.lineTo(x - s * 0.3, y + s * 0.3);
  c.lineTo(x - s, y);
  c.lineTo(x - s * 0.3, y - s * 0.3);
  c.closePath();
  c.fillStyle = css(0xffffff, 0.95);
  c.fill();
}

// ---------- Ball of yarn (cats) ----------

function paintYarn(scene: Phaser.Scene): void {
  paint(scene, 'toss-yarn', 26, 26, (c) => {
    const base = 0xe2557a;
    circle(c, 13, 13, 11.5);
    fillOut(c, rad(c, 9, 8, 1, 13, 13, 13, [[0, shade(base, 0.45)], [0.55, base], [1, shade(base, -0.45)]]), shade(base, -0.6), 1.2);
    c.save();
    circle(c, 13, 13, 11.5);
    c.clip();
    // wound strands in a few directions
    for (const [a, n] of [[0.5, 6], [-0.7, 5], [1.6, 4]] as [number, number][]) {
      c.save();
      c.translate(13, 13);
      c.rotate(a);
      for (let i = 0; i < n; i++) {
        const y = -11 + (i + 0.5) * (22 / n);
        c.beginPath();
        c.moveTo(-13, y);
        c.quadraticCurveTo(0, y - 3, 13, y);
        c.strokeStyle = css(shade(base, i % 2 ? 0.3 : -0.25), 0.7);
        c.lineWidth = 1.1;
        c.stroke();
      }
      c.restore();
    }
    c.restore();
    // a loose end
    line(c, [[20, 20], [24, 23], [25, 25.5]], shade(base, -0.2), 1.3);
    ellipse(c, 9, 8, 3.4, 2, -0.6);
    c.fillStyle = css(0xffffff, 0.35);
    c.fill();
  });
}

// ---------- Sprinkler ----------

function paintSprinkler(scene: Phaser.Scene): void {
  paint(scene, 'toss-sprinkler', 30, 22, (c) => {
    ellipse(c, 15, 18, 13, 3.6);
    c.fillStyle = css(0x2d5a1f, 0.45);
    c.fill();
    rrect(c, 12, 6, 6, 13, 1.5);
    fillOut(c, roundX(c, 12, 18, 0x9aa3ab, 0.3, -0.4), 0x3d444a, 1);
    rrect(c, 6, 3, 18, 4, 2);
    fillOut(c, roundY(c, 3, 7, 0xf2c230, 0.3, -0.35), 0x7a5a10, 1);
    circle(c, 15, 4, 2.4);
    fillOut(c, css(0x6a737a), 0x2f3438, 0.8);
  });
  paint(scene, 'toss-drop', 8, 8, (c) => {
    circle(c, 4, 4, 3);
    c.fillStyle = rad(c, 3, 3, 0.3, 4, 4, 3.2, [[0, 0xffffff, 0.95], [0.5, 0xbfe6ff, 0.85], [1, 0x6fb8ef, 0.6]]);
    c.fill();
  });
}

// ---------- A ball's shadow on the grass (darker than the runner's soft one) ----------

function paintShadow(scene: Phaser.Scene): void {
  paint(scene, 'toss-shadow', 40, 14, (c) => {
    c.save();
    c.translate(20, 7);
    c.scale(1, 6 / 19);
    circle(c, 0, 0, 19);
    c.fillStyle = rad(c, 0, 0, 0, 0, 0, 19, [[0, 0x0e2408, 1], [0.6, 0x0e2408, 0.75], [1, 0x0e2408, 0]]);
    c.fill();
    c.restore();
  });
}
