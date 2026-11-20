import Phaser from 'phaser';
import { GROUND_Y } from '../config';
import {
  blob, circle, css, ellipse, fillOut, grain, leaf, lin, line, mix, paint, rad, roundX, roundY, rrect, seeded, shade, type Ctx,
} from './paint';

/**
 * Painted versions of the trail's props: the obstacles on levels 1 to 6, the
 * tree they hang from, the treats, the ball and the soft shadow. Each keeps
 * the size of the flat version it replaces, so hit areas don't change.
 * Light comes from the upper left, like the painted skies.
 */

const TAU = Math.PI * 2;
const BARK = 0x6b4423;

export function paintProps(scene: Phaser.Scene): void {
  paintTreats(scene);
  paintParkProps(scene);
  paintBeachProps(scene);
  paintStreetProps(scene);
  paintRiverProps(scene);
  paintSnowProps(scene);
}

// ---------- Shared bits ----------

/** A hanging cluster of leaves around a point, darker at the back. */
export function leafCluster(c: Ctx, r: () => number, x: number, y: number, size: number, greens: number[], maxY: number): void {
  for (let layer = 0; layer < 3; layer++) {
    const n = 7 + layer * 3;
    for (let i = 0; i < n; i++) {
      const a = Math.PI * 0.5 + (r() - 0.5) * 2.6;
      const d = r() * size * (0.75 - layer * 0.18);
      const lx = x + Math.cos(a) * d * 0.8 - (layer === 2 ? size * 0.15 : 0);
      const ly = y + Math.sin(a) * d * 0.55 - (layer === 2 ? size * 0.2 : 0);
      const len = Math.min(size * (0.55 + r() * 0.25), maxY - ly - 1);
      if (len < 3) continue;
      const col = shade(greens[layer], (r() - 0.5) * 0.12);
      leaf(c, lx, ly, len, len * 0.32, a + (r() - 0.5) * 0.6, col, shade(col, -0.35));
    }
  }
}

/** A limb across the top that leaves and needles hang from. */
export function limb(c: Ctx, bark: number): void {
  c.beginPath();
  c.moveTo(110, 5.5);
  c.quadraticCurveTo(60, 8, 5, 12.5);
  c.quadraticCurveTo(1.5, 15, 5, 18);
  c.quadraticCurveTo(60, 16.5, 110, 15.5);
  c.closePath();
  fillOut(c, roundY(c, 5, 17, bark, 0.3, -0.35), shade(bark, -0.55), 1.2);
  line(c, [[100, 8.5], [60, 10.5], [14, 14]], shade(bark, 0.35), 1, 0.45);
  for (const [x0, y0, x1, y1] of [[70, 12, 52, 30], [36, 14, 20, 30], [90, 10, 84, 22]]) {
    line(c, [[x0, y0], [(x0 + x1) / 2 + 2, (y0 + y1) / 2], [x1, y1]], shade(bark, -0.45), 4.2);
    line(c, [[x0, y0], [(x0 + x1) / 2 + 2, (y0 + y1) / 2], [x1, y1]], bark, 2.6);
  }
}

/** A round leafy crown built from puffs: shadowed base, lit tops, leafy edges. */
export function crown(c: Ctx, puffs: [number, number, number][], greens: [number, number, number, number], seed: number, w: number, h: number): void {
  const r = seeded(seed);
  const [dark, mid, light, glow] = greens;
  for (const [x, y, rr] of puffs) {
    circle(c, x, y, rr);
    c.fillStyle = css(dark);
    c.fill();
  }
  for (const [x, y, rr] of puffs) {
    circle(c, x - rr * 0.12, y - rr * 0.14, rr * 0.86);
    c.fillStyle = rad(c, x - rr * 0.45, y - rr * 0.5, rr * 0.1, x, y, rr, [[0, light], [0.55, mid], [1, mid, 0]]);
    c.fill();
  }
  // leafy texture: lit leaves up and left, shadowed ones down and right
  for (let i = 0; i < 900; i++) {
    const [x, y, rr] = puffs[Math.floor(r() * puffs.length)];
    const a = r() * TAU;
    const d = Math.sqrt(r()) * rr * 1.02;
    const lx = x + Math.cos(a) * d;
    const ly = y + Math.sin(a) * d;
    if (lx < 2 || lx > w - 2 || ly < 2 || ly > h - 2) continue;
    const lit = (-(lx - x) - (ly - y)) / (rr * 1.4);
    const col = lit > 0.35 ? (r() < 0.4 ? glow : light) : lit < -0.3 ? shade(dark, -0.15) : r() < 0.5 ? mid : dark;
    leaf(c, lx, ly, 3 + r() * 3, 1.3 + r() * 0.8, r() * TAU, col);
  }
}

// ---------- Treats, ball and shadow ----------

function paintTreats(scene: Phaser.Scene): void {
  paint(scene, 'shadow', 64, 14, (c) => {
    c.save();
    c.translate(32, 7);
    c.scale(1, 7 / 32);
    circle(c, 0, 0, 32);
    c.fillStyle = rad(c, 0, 0, 0, 0, 0, 32, [[0, 0x000000, 0.34], [0.55, 0x000000, 0.18], [1, 0x000000, 0]]);
    c.fill();
    c.restore();
  });

  paint(scene, 'bone', 24, 14, (c) => {
    const shape = () => {
      c.beginPath();
      c.rect(5, 4.5, 14, 5);
      for (const [x, y] of [[4, 4], [4, 10], [20, 4], [20, 10]]) {
        c.moveTo(x + 3.3, y);
        c.arc(x, y, 3.3, 0, TAU);
      }
    };
    shape();
    c.strokeStyle = css(0x9c8460);
    c.lineWidth = 2.2;
    c.stroke();
    shape();
    c.fillStyle = lin(c, 0, 0.5, 0, 13.5, [[0, 0xfffaf0], [0.45, 0xf4e3c1], [1, 0xc9ad80]]);
    c.fill();
    line(c, [[6, 5.8], [18, 5.8]], 0xffffff, 1.2, 0.75);
    circle(c, 3, 2.8, 1.1);
    c.fillStyle = css(0xffffff, 0.8);
    c.fill();
  });

  paint(scene, 'fish', 26, 14, (c) => {
    const body = lin(c, 0, 1, 0, 13, [[0, 0xffc29a], [0.45, 0xf28c5a], [1, 0xb85a2a]]);
    c.beginPath();
    c.moveTo(18.5, 7);
    c.lineTo(25, 1.5);
    c.quadraticCurveTo(22.5, 7, 25, 12.5);
    c.closePath();
    fillOut(c, body, 0x8a4220, 1.1);
    c.beginPath();
    c.moveTo(8, 2.2);
    c.quadraticCurveTo(12, -0.5, 15, 2.5);
    fillOut(c, css(0xe0784a), 0x8a4220, 0.9);
    ellipse(c, 11, 7, 9.5, 5.4);
    fillOut(c, body, 0x8a4220, 1.1);
    for (const [x, y] of [[12, 5], [15, 7], [12, 9], [9, 7]]) {
      c.beginPath();
      c.arc(x, y, 1.8, -1.2, 1.2);
      c.strokeStyle = css(0x9a4a22, 0.35);
      c.lineWidth = 0.7;
      c.stroke();
    }
    c.beginPath();
    c.arc(4.5, 7, 3.5, -0.9, 0.9);
    c.strokeStyle = css(0x9a4a22, 0.55);
    c.lineWidth = 0.8;
    c.stroke();
    ellipse(c, 10.5, 4.3, 4.2, 1.2);
    c.fillStyle = css(0xffffff, 0.5);
    c.fill();
    circle(c, 4.8, 5.6, 1.8);
    c.fillStyle = css(0xffffff);
    c.fill();
    circle(c, 4.5, 5.7, 1.05);
    c.fillStyle = css(0x1a1a1a);
    c.fill();
  });

  paint(scene, 'ball', 28, 28, (c) => {
    circle(c, 14, 14, 13);
    c.fillStyle = rad(c, 10, 9, 1, 14, 14, 14, [[0, 0xf6ffaa], [0.5, 0xd8e65a], [1, 0x8a9a1c]]);
    c.fill();
    grain(c, 28, 28, 0.12, 0, 4, 64);
    c.save();
    circle(c, 14, 14, 13);
    c.clip();
    for (const [cx, a0, a1] of [[2, -1.1, 1.1], [26, Math.PI - 1.1, Math.PI + 1.1]]) {
      c.beginPath();
      c.arc(cx, 14.6, 11, a0, a1);
      c.strokeStyle = css(0x6f7a20, 0.35);
      c.lineWidth = 2.4;
      c.stroke();
      c.beginPath();
      c.arc(cx, 14, 11, a0, a1);
      c.strokeStyle = css(0xffffff, 0.95);
      c.lineWidth = 1.9;
      c.stroke();
    }
    c.restore();
    circle(c, 14, 14, 13);
    c.strokeStyle = css(0x6f7f18);
    c.lineWidth = 1.4;
    c.stroke();
    ellipse(c, 9.5, 8, 4, 2.4, -0.6);
    c.fillStyle = css(0xffffff, 0.5);
    c.fill();
  });
}

// ---------- Level 1 and 2: park and hills ----------

function paintParkProps(scene: Phaser.Scene): void {
  const greens = [0x2f5e2a, 0x4f8a3a, 0x8dbb4f];

  paint(scene, 'fence', 34, 50, (c) => {
    const wood = 0xc08a52;
    const dark = 0x5e3d22;
    for (const y of [16, 34]) {
      rrect(c, 0.6, y, 32.8, 6, 1.5);
      fillOut(c, roundY(c, y, y + 6, wood, 0.2, -0.3), dark, 1.1);
    }
    for (const x of [3, 21]) {
      c.beginPath();
      c.moveTo(x, 8.5);
      c.lineTo(x + 5, 0.8);
      c.lineTo(x + 10, 8.5);
      c.lineTo(x + 10, 49.3);
      c.lineTo(x, 49.3);
      c.closePath();
      fillOut(c, roundX(c, x, x + 10, wood, 0.22, -0.32), dark, 1.3);
      line(c, [[x + 3.2, 12], [x + 3.6, 22], [x + 3, 31]], dark, 0.7, 0.4);
      line(c, [[x + 6.8, 27], [x + 6.4, 37], [x + 7, 46]], dark, 0.7, 0.4);
      line(c, [[x + 1.6, 9], [x + 1.6, 48]], 0xffffff, 0.9, 0.25);
      for (const y of [19, 37]) {
        circle(c, x + 5, y, 0.9);
        c.fillStyle = css(0x2a1c10, 0.85);
        c.fill();
      }
    }
    grain(c, 34, 50, 0.06, 0, 5, 64);
  });

  paint(scene, 'branch', 110, 50, (c) => {
    limb(c, BARK);
    const r = seeded(3);
    for (const [x, y, s] of [[10, 24, 12], [28, 32, 13], [48, 34, 12], [64, 28, 12], [84, 22, 11], [22, 19, 9], [56, 20, 9], [94, 15, 8], [40, 26, 10]]) {
      leafCluster(c, r, x, y, s, greens, 49);
    }
  });

  paint(scene, 'trunk', 26, GROUND_Y - 75, (c) => {
    const h = GROUND_Y - 75;
    const r = seeded(9);
    c.fillStyle = roundX(c, 0, 26, BARK, 0.25, -0.45);
    c.fillRect(0, 0, 26, h);
    for (let i = 0; i < 10; i++) {
      const x = 2 + i * 2.4 + r() * 1.5;
      const pts: [number, number][] = [];
      for (let y = 0; y <= h; y += 14) pts.push([x + Math.sin(y / 23 + i) * 1.3, y]);
      line(c, pts, shade(BARK, -0.45), 0.8 + r() * 0.9, 0.45);
    }
    for (let i = 0; i < 3; i++) {
      const y = 40 + r() * (h - 80);
      ellipse(c, 9 + r() * 8, y, 3, 5);
      fillOut(c, css(shade(BARK, -0.35)), shade(BARK, 0.25), 0.9, 0.6);
    }
    line(c, [[0.7, 0], [0.7, h]], shade(BARK, -0.6), 1.4, 0.6);
    line(c, [[25.3, 0], [25.3, h]], shade(BARK, -0.6), 1.4, 0.7);
    grain(c, 26, h, 0.06, 0, 6, 64);
  });

  paint(scene, 'canopy', 180, 110, (c) => {
    crown(c, [[30, 62, 33], [90, 72, 38], [150, 60, 31], [60, 38, 30], [120, 36, 31], [90, 30, 26]], [0x2a5226, 0x4a8236, 0x86b84a, 0xc2dc6a], 12, 180, 110);
  });

  paint(scene, 'log', 64, 34, (c) => {
    const bark = 0x8a5a32;
    const r = seeded(14);
    rrect(c, 2, 4.5, 56, 27.5, 12);
    fillOut(c, roundY(c, 4.5, 32, bark, 0.28, -0.42), shade(bark, -0.55), 1.4);
    for (let i = 0; i < 9; i++) {
      const y = 8 + i * 2.7 + r();
      const x0 = 6 + r() * 14;
      const x1 = x0 + 12 + r() * 26;
      line(c, [[x0, y], [(x0 + x1) / 2, y + (r() - 0.5) * 1.2], [x1, y]], shade(bark, i < 3 ? 0.3 : -0.4), 0.9, i < 3 ? 0.4 : 0.5);
    }
    ellipse(c, 56, 18, 7, 13.6);
    fillOut(c, rad(c, 55, 17, 1, 56, 18, 13, [[0, 0xf0c994], [0.6, 0xd9a86c], [1, 0xa8773f]]), 0x7a5028, 1.2);
    for (const k of [0.68, 0.42, 0.18]) {
      ellipse(c, 56, 18, 7 * k, 13.6 * k);
      c.strokeStyle = css(0x9c6b3c, 0.6);
      c.lineWidth = 0.8;
      c.stroke();
    }
    line(c, [[56, 18], [58.5, 11], [59, 6.5]], 0x7a5028, 0.8, 0.6);
    for (const [x, y, s] of [[20, 5.5, 4], [26, 4.5, 3], [15, 6.5, 2.5]]) {
      for (let k = 0; k < 5; k++) {
        circle(c, x + (r() - 0.5) * s, y + (r() - 0.5) * s * 0.5, s * 0.55);
        c.fillStyle = css(k < 2 ? 0x3f7a2e : k < 4 ? 0x5f9c3a : 0x9cc85a);
        c.fill();
      }
    }
    grain(c, 64, 34, 0.06, 0, 15, 64);
  });

  paint(scene, 'rock', 46, 38, (c) => {
    blob(c, [[1.5, 37.5], [2.5, 26], [7, 15], [15, 8.5], [26, 6], [36, 9.5], [43, 18], [45, 29], [44.5, 37.5]]);
    fillOut(c, rad(c, 15, 13, 1, 22, 22, 27, [[0, 0xd2d4da], [0.4, 0x9a9ca3], [1, 0x55575d]]), 0x3f4146, 1.4);
    c.save();
    c.clip();
    blob(c, [[24, 40], [28, 24], [38, 14], [48, 24], [48, 40]]);
    c.fillStyle = css(0x2f3136, 0.25);
    c.fill();
    c.restore();
    line(c, [[8, 16], [15, 10], [25, 7.5]], 0xffffff, 1.3, 0.4);
    line(c, [[27, 22], [31, 27], [29, 33]], 0x3f4146, 0.9, 0.6);
    line(c, [[31, 27], [36, 29]], 0x3f4146, 0.8, 0.5);
    grain(c, 46, 38, 0.12, 0, 16, 64);
    for (const [x, y, s] of [[29, 8, 3.5], [33, 9, 2.5], [25, 8.5, 2]]) {
      ellipse(c, x, y, s, s * 0.55);
      c.fillStyle = css(0x5f9c3a);
      c.fill();
    }
    ellipse(c, 28.5, 7.6, 2.4, 1);
    c.fillStyle = css(0x9cc85a);
    c.fill();
  });
}

// ---------- Level 3: Sunset Beach ----------

function paintBeachProps(scene: Phaser.Scene): void {
  paint(scene, 'sandcastle', 50, 52, (c) => {
    const sand = 0xe2bf7a;
    const dark = 0x9e7440;
    ellipse(c, 25, 49.5, 24.5, 3);
    c.fillStyle = css(shade(sand, -0.15));
    c.fill();
    const wall = (x: number, y: number, w: number, h: number, merlons: number) => {
      const mw = w / (merlons * 2 - 1);
      c.beginPath();
      c.moveTo(x, y + h);
      c.lineTo(x, y);
      for (let i = 0; i < merlons; i++) {
        const mx = x + i * 2 * mw;
        c.lineTo(mx, y - 4.5);
        c.lineTo(mx + mw, y - 4.5);
        c.lineTo(mx + mw, y);
        if (i < merlons - 1) c.lineTo(mx + 2 * mw, y);
      }
      c.lineTo(x + w, y + h);
      c.closePath();
      fillOut(c, roundX(c, x, x + w, sand, 0.22, -0.3), dark, 1.1);
    };
    wall(16, 12.5, 18, 16, 3);
    wall(4, 27, 42, 23, 5);
    c.beginPath();
    c.moveTo(21, 50);
    c.lineTo(21, 43);
    c.arc(25, 43, 4, Math.PI, 0);
    c.lineTo(29, 50);
    c.closePath();
    fillOut(c, lin(c, 0, 39, 0, 50, [[0, 0x6a4a28], [1, 0x8a6236]]), dark, 0.9);
    c.beginPath();
    c.moveTo(23.5, 23);
    c.lineTo(23.5, 19.5);
    c.arc(25, 19.5, 1.5, Math.PI, 0);
    c.lineTo(26.5, 23);
    c.closePath();
    c.fillStyle = css(0x6a4a28);
    c.fill();
    // drips and pats of wet sand
    const r = seeded(18);
    for (let i = 0; i < 14; i++) {
      circle(c, 6 + r() * 38, 29 + r() * 18, 0.9 + r() * 1.2);
      c.fillStyle = css(r() < 0.5 ? shade(sand, 0.2) : shade(sand, -0.18), 0.8);
      c.fill();
    }
    line(c, [[5.5, 28], [5.5, 49]], 0xffffff, 1, 0.3);
    grain(c, 50, 52, 0.12, 0, 19, 64);
    line(c, [[25, 8], [25, 0.8]], 0x6e4a2b, 1.2);
    c.beginPath();
    c.moveTo(25.5, 0.8);
    c.quadraticCurveTo(29, 1.2, 33, 3.2);
    c.quadraticCurveTo(29, 4.6, 25.5, 6);
    c.closePath();
    c.fillStyle = lin(c, 25, 0, 33, 0, [[0, 0xf0583e], [1, 0xb8301e]]);
    c.fill();
  });

  paint(scene, 'driftwood', 78, 26, (c) => {
    const col = 0xb7a28a;
    const out = shade(col, -0.55);
    c.beginPath();
    c.moveTo(48, 12);
    c.quadraticCurveTo(57, 5, 64.5, 0.8);
    c.quadraticCurveTo(67.5, 2, 66, 4);
    c.quadraticCurveTo(60, 9, 56, 13);
    c.closePath();
    fillOut(c, roundY(c, 0, 13, col, 0.25, -0.3), out, 1.1);
    c.beginPath();
    c.moveTo(4, 15);
    c.quadraticCurveTo(10, 8.5, 30, 10);
    c.quadraticCurveTo(52, 8, 72, 11);
    c.quadraticCurveTo(77, 13, 75, 18);
    c.quadraticCurveTo(70, 23, 50, 22.5);
    c.quadraticCurveTo(26, 25.5, 8, 23.5);
    c.quadraticCurveTo(1.5, 21, 4, 15);
    c.closePath();
    fillOut(c, roundY(c, 9, 25, col, 0.3, -0.4), out, 1.2);
    const r = seeded(22);
    for (let i = 0; i < 7; i++) {
      const y = 12.5 + i * 1.6;
      const x0 = 6 + r() * 10;
      line(c, [[x0, y + 0.5], [30, y - 0.6 + r()], [52, y + 0.3], [70 - r() * 8, y + 0.4]], i < 2 ? 0xffffff : shade(col, -0.35), 0.7, i < 2 ? 0.45 : 0.5);
    }
    ellipse(c, 33, 17.5, 3, 1.8);
    fillOut(c, css(shade(col, -0.45)), shade(col, 0.2), 0.8);
    grain(c, 78, 26, 0.07, 0, 23, 64);
  });

  paint(scene, 'umbrella', 124, 46, (c) => {
    const colors = [0xd6402b, 0xfff4e0];
    const cx = 62;
    const top = 2;
    const rim = 43;
    // The ribs are the dome's meridians seen from the side, so the panels
    // narrow toward the edges and the canopy reads as round.
    const meridian = (phi: number): [number, number][] => {
      const pts: [number, number][] = [];
      for (let k = 0; k <= 12; k++) {
        const t = (k / 12) * (Math.PI / 2);
        pts.push([cx + 60 * Math.sin(t) * Math.cos(phi), rim - (rim - top) * Math.cos(t)]);
      }
      return pts;
    };
    const phis = [0, 1, 2, 3, 4, 5, 6].map((i) => Math.PI - (i * Math.PI) / 6);
    phis.slice(0, 6).forEach((phi, i) => {
      const a = meridian(phi);
      const b = meridian(phis[i + 1]).reverse();
      const x0 = a[a.length - 1][0];
      const x1 = b[0][0];
      c.beginPath();
      a.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.quadraticCurveTo((x0 + x1) / 2, rim + 4.5, x1, rim);
      b.forEach(([x, y]) => c.lineTo(x, y));
      c.closePath();
      c.fillStyle = css(colors[i % 2]);
      c.fill();
    });
    const dome = () => {
      c.beginPath();
      c.ellipse(cx, rim, 60, rim - top, 0, Math.PI, TAU);
      c.lineTo(122, rim + 4);
      c.lineTo(2, rim + 4);
      c.closePath();
    };
    c.save();
    dome();
    c.clip();
    c.globalCompositeOperation = 'source-atop';
    // light from the upper left, shade underneath and along the far side
    c.fillStyle = rad(c, 42, 8, 4, 52, 20, 72, [[0, 0xffffff, 0.4], [0.45, 0xffffff, 0.04], [1, 0x000000, 0.28]]);
    c.fillRect(0, 0, 124, 46);
    c.fillStyle = lin(c, 0, 28, 0, 46, [[0, 0x000000, 0], [1, 0x000000, 0.22]]);
    c.fillRect(0, 0, 124, 46);
    c.restore();
    for (const phi of phis.slice(1, 6)) line(c, meridian(phi), 0x7a1e12, 0.9, 0.35);
    c.beginPath();
    c.ellipse(cx, rim, 60, rim - top, 0, Math.PI, TAU);
    c.strokeStyle = css(0x7a1e12, 0.85);
    c.lineWidth = 1.4;
    c.stroke();
    circle(c, cx, 2.6, 2.4);
    c.fillStyle = rad(c, cx - 0.8, 1.6, 0.2, cx, 2.6, 2.4, [[0, 0xc89a6a], [1, 0x5e3d20]]);
    c.fill();
  });

  paint(scene, 'umbrella-pole', 6, 100, (c) => {
    c.fillStyle = lin(c, 1, 0, 5, 0, [[0, 0xdedede], [0.35, 0xffffff], [1, 0x8a8a8a]]);
    c.fillRect(1, 0, 4, 100);
    line(c, [[1.2, 0], [1.2, 100]], 0x000000, 0.6, 0.25);
    line(c, [[4.8, 0], [4.8, 100]], 0x000000, 0.6, 0.35);
  });
}

// ---------- Level 4: Main Street ----------

function paintStreetProps(scene: Phaser.Scene): void {
  paint(scene, 'trashcan', 34, 46, (c) => {
    const metal = 0x7d8a8f;
    const out = 0x353d40;
    c.beginPath();
    c.moveTo(4.5, 10);
    c.lineTo(29.5, 10);
    c.lineTo(28.3, 45.5);
    c.lineTo(5.7, 45.5);
    c.closePath();
    fillOut(c, roundX(c, 4.5, 29.5, metal, 0.4, -0.45), out, 1.2);
    for (const x of [9.5, 15, 20.5, 26]) {
      line(c, [[x, 13.5], [x - (x - 17) * 0.03, 42]], shade(metal, -0.45), 1.6, 0.45);
      line(c, [[x - 1.1, 13.5], [x - 1.1 - (x - 17) * 0.03, 42]], 0xffffff, 0.8, 0.35);
    }
    for (const y of [12.5, 43]) line(c, [[5.5, y], [28.5, y]], shade(metal, -0.35), 1.6, 0.7);
    for (const [x, y] of [[24, 30], [11, 38]]) {
      ellipse(c, x, y, 2.2, 1.4);
      c.fillStyle = css(0x8a5a2a, 0.3);
      c.fill();
    }
    rrect(c, 12.5, 0.8, 9, 4.8, 2);
    fillOut(c, roundY(c, 0.8, 5.6, shade(metal, -0.2), 0.3, -0.3), out, 1);
    rrect(c, 1, 4.5, 32, 7, 3.2);
    fillOut(c, roundY(c, 4.5, 11.5, metal, 0.45, -0.35), out, 1.2);
    line(c, [[3.5, 6], [30, 6]], 0xffffff, 0.9, 0.5);
    grain(c, 34, 46, 0.05, 0, 25, 64);
  });

  paint(scene, 'hydrant', 28, 38, (c) => {
    const red = 0xc9372c;
    const out = shade(red, -0.62);
    rrect(c, 2, 16, 24, 7, 2.5);
    fillOut(c, roundY(c, 16, 23, red, 0.3, -0.4), out, 1);
    for (const x of [1.2, 21.8]) {
      rrect(c, x, 15, 5, 9, 1.6);
      fillOut(c, roundY(c, 15, 24, shade(red, -0.08), 0.3, -0.4), out, 1);
      circle(c, x + 2.5, 19.5, 1);
      c.fillStyle = css(shade(red, -0.5));
      c.fill();
    }
    rrect(c, 7, 9, 14, 26, 3);
    fillOut(c, roundX(c, 7, 21, red, 0.38, -0.45), out, 1.2);
    ellipse(c, 14, 9.6, 8, 5.4);
    fillOut(c, rad(c, 11.5, 7, 0.5, 14, 9.6, 8.5, [[0, shade(red, 0.5)], [0.5, red], [1, shade(red, -0.35)]]), out, 1.1);
    rrect(c, 11.5, 1.6, 5, 4.4, 1.2);
    fillOut(c, roundX(c, 11.5, 16.5, shade(red, -0.15)), out, 0.9);
    line(c, [[7.5, 26.5], [20.5, 26.5]], shade(red, -0.45), 2, 0.8);
    rrect(c, 4, 33.6, 20, 4.2, 1.5);
    fillOut(c, roundY(c, 33.6, 37.8, shade(red, -0.1), 0.3, -0.4), out, 1);
    for (const x of [6.5, 21.5]) {
      circle(c, x, 35.7, 0.8);
      c.fillStyle = css(0xf0c0a0, 0.8);
      c.fill();
    }
    line(c, [[10, 11.5], [10, 31]], 0xffffff, 1.5, 0.45);
    grain(c, 28, 38, 0.05, 0, 26, 64);
  });

  paint(scene, 'sign', 36, 44, (c) => {
    const wood = 0x6b4a2f;
    c.beginPath();
    c.moveTo(1.5, 43.5);
    c.lineTo(16, 1);
    c.lineTo(20, 1);
    c.lineTo(34.5, 43.5);
    c.lineTo(30.5, 43.5);
    c.lineTo(18, 7);
    c.lineTo(5.5, 43.5);
    c.closePath();
    fillOut(c, roundX(c, 1.5, 34.5, wood, 0.3, -0.4), shade(wood, -0.5), 1.1);
    c.beginPath();
    c.moveTo(6.3, 40.5);
    c.lineTo(18, 7);
    c.lineTo(29.7, 40.5);
    c.closePath();
    fillOut(c, lin(c, 8, 10, 26, 40, [[0, 0x46564c], [1, 0x26302a]]), 0x1a201c, 0.9);
    const r = seeded(27);
    for (let i = 0; i < 12; i++) line(c, [[10 + r() * 14, 16 + r() * 22], [12 + r() * 14, 16 + r() * 22]], 0xffffff, 1.4, 0.06);
    const chalk = (pts: [number, number][], a = 0.9) => line(c, pts, 0xf4efe0, 1.3, a);
    chalk([[13.5, 22.5], [16, 22], [18.5, 23], [21, 22.2], [22.5, 22.6]]);
    chalk([[12, 28.5], [15, 28], [18, 28.8], [21, 28.2], [24, 28.6]]);
    // a little chalk heart
    c.beginPath();
    c.moveTo(18, 37);
    c.bezierCurveTo(14, 34, 15, 31, 18, 32.8);
    c.bezierCurveTo(21, 31, 22, 34, 18, 37);
    c.fillStyle = css(0xf2a0a8, 0.9);
    c.fill();
    line(c, [[16.5, 1.5], [3, 42.5]], 0xffffff, 0.7, 0.3);
  });

  paint(scene, 'awning', 124, 42, (c) => {
    const stripes = [0x3f7d3a, 0xf4efe0];
    for (let i = 0; i < 8; i++) {
      c.fillStyle = css(stripes[i % 2]);
      c.fillRect(2 + i * 15, 4, 15, 26);
      c.beginPath();
      c.arc(9.5 + i * 15, 30, 7.5, 0, Math.PI);
      c.closePath();
      c.fill();
    }
    c.save();
    c.beginPath();
    c.rect(2, 4, 120, 26);
    for (let i = 0; i < 8; i++) {
      c.moveTo(17 + i * 15, 30);
      c.arc(9.5 + i * 15, 30, 7.5, 0, Math.PI);
    }
    c.clip();
    c.fillStyle = lin(c, 0, 4, 0, 38, [[0, 0xffffff, 0.22], [0.45, 0xffffff, 0], [0.8, 0x000000, 0.12], [1, 0x000000, 0.3]]);
    c.fillRect(0, 0, 124, 42);
    for (let i = 1; i < 8; i++) line(c, [[2 + i * 15, 5], [2 + i * 15, 31]], 0x000000, 0.8, 0.18);
    c.restore();
    for (let i = 0; i < 8; i++) {
      c.beginPath();
      c.arc(9.5 + i * 15, 30, 7.5, 0, Math.PI);
      c.strokeStyle = css(shade(stripes[i % 2], -0.5), 0.7);
      c.lineWidth = 1;
      c.stroke();
    }
    rrect(c, 0, 0, 124, 5.5, 1.5);
    fillOut(c, roundY(c, 0, 5.5, 0x3a3a4a, 0.4, -0.4), 0x15151c, 0.9);
  });
}

// ---------- Level 5: Rainy Riverside ----------

function paintRiverProps(scene: Phaser.Scene): void {
  paint(scene, 'stump', 42, 36, (c) => {
    const bark = 0x7a5232;
    const out = shade(bark, -0.55);
    c.beginPath();
    c.moveTo(5, 10);
    c.lineTo(5, 29);
    c.quadraticCurveTo(3, 34, 0.5, 35.5);
    c.lineTo(41.5, 35.5);
    c.quadraticCurveTo(39, 34, 37, 29);
    c.lineTo(37, 10);
    c.closePath();
    fillOut(c, roundX(c, 0, 42, bark, 0.25, -0.45), out, 1.3);
    const r = seeded(30);
    for (let i = 0; i < 8; i++) {
      const x = 8 + i * 3.8 + r();
      line(c, [[x, 13], [x + (r() - 0.5) * 2, 22], [x + (x - 21) * 0.08, 33]], shade(bark, -0.45), 0.9, 0.5);
    }
    ellipse(c, 21, 10, 16.5, 6);
    fillOut(c, rad(c, 19, 9, 1, 21, 10, 17, [[0, 0xeac08a], [0.65, 0xc89a62], [1, 0x9c6b3c]]), out, 1.2);
    for (const k of [0.68, 0.4, 0.15]) {
      ellipse(c, 21, 10, 16.5 * k, 6 * k);
      c.strokeStyle = css(0x9c6b3c, 0.6);
      c.lineWidth = 0.8;
      c.stroke();
    }
    line(c, [[21, 10], [27, 12.5], [31, 12]], 0x7a5028, 0.8, 0.6);
    for (const [x, y, s] of [[9, 31, 4], [13, 32.5, 3], [33, 25, 2.5]]) {
      for (let k = 0; k < 6; k++) {
        circle(c, x + (r() - 0.5) * s * 1.6, y + (r() - 0.5) * s * 0.6, s * 0.5);
        c.fillStyle = css(k < 2 ? 0x3f7a2e : k < 5 ? 0x5f9c3a : 0xa0c860);
        c.fill();
      }
    }
    // a small mushroom at the foot
    line(c, [[31, 35], [31, 31]], 0xf0e6d0, 1.6);
    c.beginPath();
    c.arc(31, 31.5, 3.2, Math.PI, 0);
    c.closePath();
    fillOut(c, lin(c, 0, 28, 0, 32, [[0, 0xc0603a], [1, 0x8a3a20]]), 0x5a2a18, 0.8);
    grain(c, 42, 36, 0.06, 0, 31, 64);
  });
}

// ---------- Level 6: Snowy Night ----------

function paintSnowProps(scene: Phaser.Scene): void {
  paint(scene, 'snowman', 42, 58, (c) => {
    const ball = (x: number, y: number, r: number) => {
      circle(c, x, y, r);
      fillOut(c, rad(c, x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r, [[0, 0xffffff], [0.55, 0xeef3fb], [1, 0xaab8d2]]), 0x8a98b4, 1.1, 0.8);
    };
    // stick arms behind
    for (const pts of [[[11, 22], [5, 17.5], [1, 14]], [[31, 22], [37, 18], [41, 15]]] as [number, number][][]) {
      line(c, pts, 0x4a3220, 2.2);
      line(c, pts, 0x6b4a30, 1.2);
    }
    line(c, [[4.5, 17], [3.5, 12.5]], 0x5a3e28, 1);
    line(c, [[37.5, 17.5], [39, 13]], 0x5a3e28, 1);
    ball(21, 44, 13.5);
    ellipse(c, 21, 33, 9, 2.4);
    c.fillStyle = css(0x6a7aa0, 0.25);
    c.fill();
    ball(21, 24, 10);
    ellipse(c, 21, 15.5, 6, 1.8);
    c.fillStyle = css(0x6a7aa0, 0.25);
    c.fill();
    ball(21, 9, 7);
    // scarf with stripes and a tail
    rrect(c, 12, 14.5, 18, 4.6, 2);
    fillOut(c, roundY(c, 14.5, 19, 0xd6402b, 0.3, -0.35), 0x7a1e12, 0.9);
    c.beginPath();
    c.moveTo(24, 17);
    c.lineTo(28.5, 17);
    c.lineTo(29, 26);
    c.lineTo(24.5, 25.5);
    c.closePath();
    fillOut(c, roundX(c, 24, 29, 0xd6402b, 0.2, -0.35), 0x7a1e12, 0.9);
    for (const x of [16, 21]) line(c, [[x, 15], [x, 18.8]], 0xfff4e0, 1.3, 0.85);
    line(c, [[24.6, 21.5], [28.8, 21.8]], 0xfff4e0, 1.2, 0.85);
    for (const x of [25, 26.5, 28]) line(c, [[x, 25.6], [x, 27.5]], 0xd6402b, 0.9);
    // coal eyes, buttons and a carrot nose
    for (const [x, y, r] of [[18, 7.8, 1.4], [24, 7.8, 1.4], [21, 25, 1.6], [21, 31, 1.6], [21, 40, 1.7]]) {
      circle(c, x, y, r);
      c.fillStyle = css(0x16202a);
      c.fill();
      circle(c, x - r * 0.35, y - r * 0.35, r * 0.35);
      c.fillStyle = css(0xffffff, 0.6);
      c.fill();
    }
    c.beginPath();
    c.moveTo(21, 9.8);
    c.lineTo(12.5, 11.2);
    c.lineTo(21, 12.3);
    c.closePath();
    fillOut(c, lin(c, 12, 10, 21, 12, [[0, 0xf6a04a], [1, 0xd8661e]]), 0x9a4a14, 0.7);
    for (const x of [18.5, 20.5, 22.5]) {
      circle(c, x, 13.6 + (x === 20.5 ? 0.6 : 0), 0.55);
      c.fillStyle = css(0x16202a, 0.8);
      c.fill();
    }
  });

  paint(scene, 'sled', 62, 26, (c) => {
    const red = 0xb5462e;
    for (const x of [10, 50]) {
      line(c, [[x, 13], [x, 22]], 0x3a3d42, 3.2);
      line(c, [[x - 0.6, 13], [x - 0.6, 22]], 0x9aa0a8, 1, 0.8);
    }
    const runner: [number, number][] = [[2, 22], [52, 22], [56, 20.5], [58.5, 16.5], [57.5, 13.5], [55, 13.5]];
    line(c, runner, 0x2e3034, 3.6);
    line(c, runner, 0x8a9098, 2);
    line(c, [[3, 21.2], [52, 21.2], [56, 19.7]], 0xe0e6ee, 0.8, 0.8);
    rrect(c, 6, 4.5, 50, 10, 3);
    fillOut(c, roundY(c, 4.5, 14.5, red, 0.3, -0.4), shade(red, -0.55), 1.1);
    for (const y of [8, 11.2]) line(c, [[8, y], [54, y]], shade(red, -0.45), 0.8, 0.5);
    for (const x of [10, 50]) {
      circle(c, x, 9.6, 0.9);
      c.fillStyle = css(0x2a1810, 0.8);
      c.fill();
    }
    line(c, [[56, 9], [59.5, 10.5], [60.5, 14], [58.5, 17]], 0x8a6a44, 1.1);
    ellipse(c, 30, 4.6, 21, 3.4);
    fillOut(c, roundY(c, 1.2, 8, 0xf4f8ff, 0.4, -0.2), 0x9aa8c4, 0.8, 0.7);
    grain(c, 62, 26, 0.04, 0, 35, 64);
  });

  const needles = (c: Ctx, r: () => number, x: number, y: number, s: number, maxY: number) => {
    for (let i = 0; i < 36; i++) {
      const a = Math.PI * 0.5 + (r() - 0.5) * 3.2;
      const len = Math.min(s * (0.6 + r() * 0.5), maxY - y - 1);
      const col = mix(0x163a2c, 0x3f7a5c, r());
      line(c, [[x, y], [x + Math.cos(a) * len, y + Math.sin(a) * len * 0.8]], col, 1.3);
    }
  };
  const snowCap = (c: Ctx, x: number, y: number, rx: number, ry: number) => {
    ellipse(c, x, y, rx, ry);
    fillOut(c, lin(c, 0, y - ry, 0, y + ry, [[0, 0xffffff], [0.6, 0xe8eef8], [1, 0xb4c2dc]]), 0x8a9abc, 0.8, 0.6);
    for (const dx of [-0.5, 0.1, 0.55]) {
      ellipse(c, x + dx * rx, y + ry * 0.75, rx * 0.16, ry * 0.55);
      c.fillStyle = css(0xe8eef8);
      c.fill();
    }
  };

  paint(scene, 'snowbranch', 110, 50, (c) => {
    limb(c, 0x5b3b22);
    const r = seeded(37);
    const tufts: [number, number, number][] = [[10, 24, 12], [28, 32, 13], [48, 34, 12], [64, 28, 12], [84, 22, 11], [40, 26, 10], [94, 15, 9]];
    for (const [x, y, s] of tufts) needles(c, r, x, y - s * 0.2, s * 1.05, 49);
    for (const [x, y, s] of tufts) snowCap(c, x, y - s * 0.55, s * 0.85, s * 0.36);
  });

  paint(scene, 'snowcanopy', 180, 110, (c) => {
    const puffs: [number, number, number][] = [[30, 62, 33], [90, 72, 38], [150, 60, 31], [60, 38, 30], [120, 36, 31], [90, 30, 26]];
    crown(c, puffs, [0x123326, 0x24503f, 0x3a6e56, 0x5a8a72], 38, 180, 110);
    // snow lying on the top of each puff
    for (const [x, y, rr] of puffs) {
      c.save();
      circle(c, x, y, rr + 0.5);
      c.clip();
      // lumpy clumps of snow along the top, so the edge isn't one clean line
      const sr = seeded(Math.round(x * 7 + y));
      c.fillStyle = lin(c, 0, y - rr, 0, y - rr * 0.1, [[0, 0xffffff], [0.55, 0xe8eef8], [1, 0xb4c2dc]]);
      for (let k = 0; k < 9; k++) {
        const a = Math.PI * (1.08 + (k / 8) * 0.84) + (sr() - 0.5) * 0.2;
        const d = rr * (0.62 + sr() * 0.2);
        ellipse(c, x + Math.cos(a) * d, y + Math.sin(a) * d, rr * (0.26 + sr() * 0.14), rr * (0.2 + sr() * 0.1));
        c.fill();
      }
      ellipse(c, x - rr * 0.12, y - rr * 0.95, rr * 0.9, rr * 0.42);
      c.fill();
      c.restore();
    }
    const r = seeded(39);
    for (let i = 0; i < 40; i++) {
      const [x, y, rr] = puffs[Math.floor(r() * puffs.length)];
      circle(c, x + (r() - 0.5) * rr * 1.4, y + (r() - 0.2) * rr * 0.8, 1 + r() * 1.6);
      c.fillStyle = css(0xffffff, 0.85);
      c.fill();
    }
  });
}

