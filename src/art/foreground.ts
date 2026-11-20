import Phaser from 'phaser';
import type { Theme } from '../levels';
import { circle, css, ellipse, fillOut, leaf, lin, line, paint, rad, roundX, seeded, shade, type Ctx } from './paint';

/**
 * A close-up strip along the bottom of the screen: grass, reeds, ferns,
 * shells, snow or the pier's railing, passing in front of the camera faster
 * than the trail. It adds depth and stays below the trail, so it never hides
 * the pet or what's coming.
 */

export const FG_W = 1024;
export const FG_H = 70;
/** How much faster than the trail it slides by. */
export const FG_SPEED = 1.35;
const TAU = Math.PI * 2;

/** Draws a thing at x, and again one strip-width over if it hangs off an edge, so the strip tiles. */
function wrap(x: number, reach: number, draw: (x: number) => void): void {
  draw(x);
  if (x < reach) draw(x + FG_W);
  if (x > FG_W - reach) draw(x - FG_W);
}

/** A clump of grass blades, darker at the root (it's close and in shade). */
function clump(c: Ctx, r: () => number, x: number, h: number, greens: number[], n = 14): void {
  for (let i = 0; i < n; i++) {
    const bx = x + (r() - 0.5) * h * 0.6;
    const bh = h * (0.45 + r() * 0.55);
    const lean = (r() - 0.5) * h * 0.7;
    const col = greens[Math.floor(r() * greens.length)];
    c.beginPath();
    c.moveTo(bx - 1.6, FG_H);
    c.quadraticCurveTo(bx + lean * 0.25, FG_H - bh * 0.6, bx + lean, FG_H - bh);
    c.quadraticCurveTo(bx + lean * 0.25 + 1.2, FG_H - bh * 0.55, bx + 1.6, FG_H);
    c.closePath();
    c.fillStyle = lin(c, 0, FG_H - bh, 0, FG_H, [[0, shade(col, 0.15)], [1, shade(col, -0.45)]]);
    c.fill();
  }
}

function flower(c: Ctx, x: number, y: number, s: number, color: number): void {
  line(c, [[x, FG_H], [x + 1, (y + FG_H) / 2], [x, y]], 0x3a5a2a, 1.2);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    circle(c, x + Math.cos(a) * s * 0.7, y + Math.sin(a) * s * 0.7, s * 0.6);
    c.fillStyle = css(k % 2 ? color : shade(color, 0.15));
    c.fill();
  }
  circle(c, x, y, s * 0.4);
  c.fillStyle = css(0xf2c84a);
  c.fill();
}

export function paintForeground(scene: Phaser.Scene, levelId: number, t: Theme): string | null {
  if (t.tufts === 'street') return null;
  const key = `fg-${levelId}`;
  paint(scene, key, FG_W, FG_H, (c) => {
    const r = seeded(500 + levelId);
    const greens = [shade(t.grassDark, -0.4), shade(t.grassDark, -0.22), shade(t.grassDark, -0.05)];
    if (t.tufts === 'grass') {
      // a low carpet of blades along the very bottom
      for (let x = 0; x < FG_W; x += 7) clump(c, seeded(x + levelId), x, 14 + r() * 8, greens, 3);
      // Jungle ferns, riverside cattails, or meadow grass with a few flowers
      for (let i = 0; i < 16; i++) {
        const x = (i + r() * 0.8) * (FG_W / 16);
        const h = 40 + r() * 24;
        wrap(x, 40, (wx) => clump(c, seeded(i * 7 + levelId), wx, h, greens, 20));
        if (levelId === 11 && i % 2 === 0) {
          wrap(x + 20, 50, (wx) => {
            const rr = seeded(i + 90);
            for (let k = 0; k < 7; k++) {
              const a = -Math.PI / 2 + (k - 3) * 0.32;
              leaf(c, wx, FG_H, 30 + rr() * 16, 7, a, k % 2 ? shade(t.grassDark, -0.2) : t.grassDark, shade(t.grassDark, -0.5));
            }
          });
        } else if (levelId === 5 && i % 3 === 0) {
          wrap(x + 14, 20, (wx) => {
            for (const dx of [0, 6]) {
              line(c, [[wx + dx, FG_H], [wx + dx + 1, 30], [wx + dx + 2, 12]], 0x4a5a32, 1.6);
              ellipse(c, wx + dx + 1.6, 18, 2.6, 7);
              fillOut(c, roundX(c, wx + dx - 1, wx + dx + 4, 0x6a4a2a, 0.3, -0.4), 0x3a2a18, 0.8);
            }
          });
        } else if (i % 3 === 1 && levelId !== 5) {
          const col = t.speckle ?? [0xf4f0e8, 0xf2c84a, 0xc8a0e8][i % 3];
          const fy = 26 + r() * 14;
          wrap(x + 10, 10, (wx) => flower(c, wx, fy, 3.4, col));
        }
      }
    } else if (t.tufts === 'sand') {
      // a dune edge with dune grass, shells and pebbles
      c.beginPath();
      c.moveTo(0, FG_H);
      for (let x = 0; x <= FG_W; x += 16) c.lineTo(x, FG_H - 14 - 8 * Math.sin((x / FG_W) * TAU * 3) - 4 * Math.sin((x / FG_W) * TAU * 7));
      c.lineTo(FG_W, FG_H);
      c.closePath();
      c.fillStyle = lin(c, 0, FG_H - 26, 0, FG_H, [[0, shade(t.grass, -0.2)], [1, shade(t.grassDark, -0.45)]]);
      c.fill();
      c.strokeStyle = css(shade(t.grass, 0.25), 0.8);
      c.lineWidth = 1.2;
      c.stroke();
      for (let i = 0; i < 8; i++) {
        const x = (i + r()) * (FG_W / 8);
        const h = 30 + r() * 16;
        wrap(x, 30, (wx) => clump(c, seeded(i + 40), wx, h, [0x8a8a4a, 0xa8a060, 0x6a6a3a], 10));
      }
      for (let i = 0; i < 10; i++) {
        const x = 20 + r() * (FG_W - 40);
        const y = FG_H - 6 - r() * 8;
        if (i % 2) {
          // a scallop shell
          c.beginPath();
          c.moveTo(x, y + 4);
          c.arc(x, y + 4, 6, Math.PI * 1.05, Math.PI * 1.95);
          c.closePath();
          fillOut(c, rad(c, x - 2, y, 0.5, x, y + 3, 7, [[0, 0xfff4e8], [1, 0xe0b8a0]]), 0x9a7a6a, 0.9);
          for (let k = -2; k <= 2; k++) line(c, [[x, y + 4], [x + k * 2.2, y - 1]], 0xb8907a, 0.6, 0.7);
        } else {
          ellipse(c, x, y, 3.5, 2.4);
          fillOut(c, rad(c, x - 1, y - 1, 0.3, x, y, 4, [[0, 0xd8d0c4], [1, 0x8a8278]]), 0x5a544a, 0.7);
        }
      }
    } else if (t.tufts === 'snow') {
      // soft snow drifts with a few twigs and berries poking out
      c.beginPath();
      c.moveTo(0, FG_H);
      for (let x = 0; x <= FG_W; x += 16) c.lineTo(x, FG_H - 20 - 10 * Math.sin((x / FG_W) * TAU * 3 + 1) - 5 * Math.sin((x / FG_W) * TAU * 8));
      c.lineTo(FG_W, FG_H);
      c.closePath();
      c.fillStyle = lin(c, 0, FG_H - 36, 0, FG_H, [[0, 0xdfe4f6], [0.45, 0xb4bcdc], [1, 0x7a84aa]]);
      c.fill();
      c.strokeStyle = css(0xffffff, 0.9);
      c.lineWidth = 1.6;
      c.stroke();
      for (let i = 0; i < 6; i++) {
        const x = (i + r()) * (FG_W / 6);
        wrap(x, 20, (wx) => {
          const rr = seeded(i + 70);
          line(c, [[wx, FG_H - 18], [wx + 4, FG_H - 38], [wx + 2, FG_H - 50]], 0x4a3a30, 1.6);
          line(c, [[wx + 4, FG_H - 38], [wx + 12, FG_H - 46]], 0x4a3a30, 1.1);
          for (let k = 0; k < 4; k++) {
            circle(c, wx + 9 + rr() * 6, FG_H - 44 + rr() * 6, 1.8);
            c.fillStyle = css(0xc8302c);
            c.fill();
          }
        });
      }
    } else if (t.tufts === 'boards') {
      // the pier's railing: posts, a top rail and a rope with lights
      for (let x = 0; x < FG_W; x += 128) {
        c.fillStyle = roundX(c, x + 2, x + 16, 0x7a5a3a, 0.3, -0.45);
        c.fillRect(x + 2, 8, 14, FG_H - 8);
        line(c, [[x + 2, 8], [x + 2, FG_H]], 0x2a1a10, 1, 0.8);
        line(c, [[x + 16, 8], [x + 16, FG_H]], 0x2a1a10, 1, 0.8);
        ellipse(c, x + 9, 8, 8, 3);
        fillOut(c, css(0x9a7a50), 0x2a1a10, 0.9);
      }
      c.fillStyle = lin(c, 0, 18, 0, 26, [[0, 0xa8845a], [1, 0x5a3e24]]);
      c.fillRect(0, 18, FG_W, 8);
      line(c, [[0, 18], [FG_W, 18]], 0xd0b080, 1, 0.7);
      for (let x = 0; x < FG_W; x += 128) {
        const pts: [number, number][] = [];
        for (let k = 0; k <= 8; k++) pts.push([x + 9 + k * 16, 34 + Math.sin((k / 8) * Math.PI) * 10]);
        line(c, pts, 0x3a2a1a, 2);
        for (let k = 1; k < 8; k += 2) {
          const [lx, ly] = pts[k];
          circle(c, lx, ly + 3, 5);
          c.fillStyle = rad(c, lx, ly + 3, 0.5, lx, ly + 3, 5, [[0, 0xfff0a0, 0.8], [1, 0xffd060, 0]]);
          c.fill();
          circle(c, lx, ly + 3, 2);
          c.fillStyle = css([0xffe08a, 0xff8a8a, 0x8ad0ff, 0xb0f08a][(k >> 1) % 4]);
          c.fill();
        }
      }
    }
  });
  return key;
}
