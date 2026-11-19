import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

/**
 * Art for Level 2 (Hilltop Trail) and Level 3 (Sunset Beach), drawn in code
 * like the rest of the game. Background layers are GAME_WIDTH wide and tile
 * sideways, so anything near an edge is drawn again one width over.
 */

type G = Phaser.GameObjects.Graphics;
const W = GAME_WIDTH;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

/** Draws a shape at x, and again a width to each side, so the tile wraps cleanly. */
function wrap(draw: (dx: number) => void): void {
  for (const dx of [-W, 0, W]) draw(dx);
}

export function makeLevelArt(scene: Phaser.Scene): void {
  // ---------- Level 2: Hilltop Trail ----------
  make(scene, 'mountains', W, 260, (g) => {
    const peak = (x: number, w: number, h: number, c: number, snow: boolean) =>
      wrap((dx) => {
        g.fillStyle(c, 1);
        g.fillTriangle(x + dx - w / 2, 260, x + dx, 260 - h, x + dx + w / 2, 260);
        if (snow) {
          g.fillStyle(0xf4f6fb, 1);
          const s = h * 0.22;
          const sw = (w / 2) * (s / h);
          g.fillTriangle(x + dx - sw, 260 - h + s, x + dx, 260 - h, x + dx + sw, 260 - h + s);
          // a jagged snow line
          g.fillTriangle(x + dx - sw, 260 - h + s, x + dx - sw / 2, 260 - h + s + 10, x + dx, 260 - h + s);
          g.fillTriangle(x + dx, 260 - h + s, x + dx + sw / 2, 260 - h + s + 8, x + dx + sw, 260 - h + s);
        }
      });
    peak(90, 360, 200, 0x9aa8cf, true);
    peak(330, 420, 240, 0x8c9bc6, true);
    peak(600, 380, 190, 0x9aa8cf, true);
    peak(820, 440, 230, 0x8c9bc6, true);
    // nearer, greener ridge
    peak(200, 420, 120, 0x86b98a, false);
    peak(520, 520, 140, 0x7cb183, false);
    peak(860, 460, 110, 0x86b98a, false);
  });
  make(scene, 'pines', W, 170, (g) => {
    const pine = (x: number, h: number, c: number) =>
      wrap((dx) => {
        g.fillStyle(0x5b3b22, 1);
        g.fillRect(x + dx - 4, 170 - 18, 8, 18);
        g.fillStyle(c, 1);
        for (let i = 0; i < 3; i++) {
          const top = 170 - h + i * (h * 0.24);
          const half = 14 + i * 9;
          g.fillTriangle(x + dx - half, top + h * 0.38, x + dx, top, x + dx + half, top + h * 0.38);
        }
      });
    const trees: [number, number, number][] = [
      [30, 120, 0x3f7a4a], [70, 90, 0x4c8a55], [210, 140, 0x3f7a4a], [250, 100, 0x4c8a55],
      [420, 110, 0x3f7a4a], [600, 150, 0x3f7a4a], [640, 105, 0x4c8a55], [790, 125, 0x4c8a55],
      [900, 95, 0x3f7a4a],
    ];
    for (const [x, h, c] of trees) pine(x, h, c);
    g.fillStyle(0x6aa85a, 1);
    for (const [x, r] of [[140, 20], [330, 26], [500, 22], [720, 24]] as const) wrap((dx) => g.fillCircle(x + dx, 170, r));
  });
  make(scene, 'log', 64, 34, (g) => {
    g.fillStyle(0x8a5a32, 1);
    g.fillRoundedRect(2, 4, 56, 28, 12);
    g.lineStyle(2, 0x5e3b1e, 1);
    g.strokeRoundedRect(2, 4, 56, 28, 12);
    g.lineStyle(1.5, 0x6d4526, 1);
    g.lineBetween(10, 12, 40, 12);
    g.lineBetween(14, 22, 46, 22);
    g.fillStyle(0xd9a86c, 1);
    g.fillEllipse(56, 18, 14, 28);
    g.lineStyle(1.5, 0x9c6b3c, 1);
    g.strokeEllipse(56, 18, 14, 28);
    g.strokeEllipse(56, 18, 7, 14);
    g.fillStyle(0x5f9c3a, 1);
    g.fillCircle(20, 5, 4);
    g.fillCircle(26, 4, 3);
  });
  make(scene, 'rock', 46, 38, (g) => {
    g.fillStyle(0x8e9097, 1);
    g.fillEllipse(23, 22, 44, 32);
    g.fillStyle(0x6d6f76, 1);
    g.fillEllipse(28, 28, 32, 18);
    g.fillStyle(0xb7b9c0, 1);
    g.fillEllipse(15, 14, 14, 8);
    g.lineStyle(2, 0x55575d, 1);
    g.strokeEllipse(23, 22, 44, 32);
    g.fillStyle(0x6aa85a, 1);
    g.fillEllipse(30, 7, 14, 5);
  });
  make(scene, 'rabbit', 40, 36, (g) => {
    // facing left
    g.fillStyle(0xa48a74, 1);
    g.fillEllipse(23, 25, 26, 18);
    g.fillCircle(10, 18, 8);
    g.fillEllipse(10, 6, 5, 16);
    g.fillEllipse(15, 6, 5, 16);
    g.fillStyle(0xe8b8b8, 1);
    g.fillEllipse(10, 6, 2, 10);
    g.fillEllipse(15, 6, 2, 10);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(36, 22, 5);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(7, 17, 1.6);
    g.fillStyle(0x84695a, 1);
    g.fillEllipse(30, 33, 12, 5);
    g.fillEllipse(14, 33, 6, 4);
  });

  // ---------- Level 3: Sunset Beach ----------
  make(scene, 'sea', W, 130, (g) => {
    // Bands from the hazy horizon down to the deeper water near the beach
    // (gradient fills don't work when baking a texture, so it's stripes)
    const bands = [0x8d7fc0, 0x7f7cbd, 0x6f78b8, 0x6074b2, 0x5372ad, 0x4870a8, 0x3f6fa4];
    bands.forEach((c, i) => {
      g.fillStyle(c, 1);
      g.fillRect(0, 10 + i * 17, W, 18);
    });
    g.fillStyle(0xffc58a, 0.55);
    for (let i = 0; i < 26; i++) {
      const x = (i * 211) % W;
      const y = 22 + ((i * 37) % 90);
      g.fillRect(x, y, 30 + (i % 4) * 12, 2);
    }
    // a little sailboat far out
    wrap((dx) => {
      g.fillStyle(0x2f2a4a, 1);
      g.fillRect(dx + 300, 20, 30, 5);
      g.fillTriangle(dx + 314, 20, dx + 314, -2, dx + 330, 18);
      g.fillStyle(0xf6e7d8, 1);
      g.fillTriangle(dx + 312, 19, dx + 312, 0, dx + 298, 18);
    });
    // foam where the waves meet the sand
    g.fillStyle(0xffffff, 0.8);
    for (let x = 0; x < W; x += 48) g.fillEllipse(x + 24, 128, 52, 8);
  });
  make(scene, 'palms', W, 220, (g) => {
    const palm = (x: number, h: number, lean: number) =>
      wrap((dx) => {
        const bx = x + dx;
        g.lineStyle(10, 0x6e4a2b, 1);
        g.beginPath();
        g.moveTo(bx, 220);
        g.lineTo(bx + lean * 0.4, 220 - h * 0.5);
        g.lineTo(bx + lean, 220 - h);
        g.strokePath();
        const tx = bx + lean;
        const ty = 220 - h;
        // Fronds: each one a fan of leaflets along a drooping curve
        const fronds: [number, number][] = [[-50, 18], [-36, 32], [48, 20], [34, 34], [-6, -20], [-46, -2], [46, -4], [14, -16]];
        fronds.forEach(([ex, ey], fi) => {
          g.fillStyle(fi % 2 ? 0x2f6b45 : 0x3d8256, 1);
          for (let k = 1; k <= 6; k++) {
            const t = k / 6;
            const px = tx + ex * t;
            const py = ty + ey * t + Math.sin(t * Math.PI) * -6 + t * t * 8;
            const w = 9 * (1 - t * 0.6);
            g.fillTriangle(tx + ex * (t - 0.2), ty + ey * (t - 0.2), px, py, px - ey * 0.12, py + w);
            g.fillTriangle(tx + ex * (t - 0.2), ty + ey * (t - 0.2), px, py, px + ey * 0.1, py - w * 0.7);
          }
        });
        g.fillStyle(0x6e4a2b, 1);
        g.fillCircle(tx - 4, ty + 6, 4);
        g.fillCircle(tx + 4, ty + 7, 4);
      });
    palm(120, 170, 24);
    palm(520, 190, -20);
    palm(760, 150, 18);
    g.fillStyle(0xe8c98a, 1);
    for (const [x, r] of [[60, 18], [300, 24], [640, 20], [880, 22]] as const) wrap((dx) => g.fillEllipse(x + dx, 220, r * 3, r));
  });
  make(scene, 'sandcastle', 50, 52, (g) => {
    const sand = 0xe2bf7a;
    const shade = 0xc49a55;
    g.fillStyle(sand, 1);
    g.fillRect(4, 26, 42, 26);
    g.fillRect(16, 12, 18, 16);
    for (const x of [4, 13, 22, 31, 40]) g.fillRect(x, 22, 6, 5);
    for (const x of [16, 23, 30]) g.fillRect(x, 8, 4, 5);
    g.fillStyle(shade, 1);
    g.fillRect(21, 40, 8, 12);
    g.fillRect(4, 48, 42, 4);
    g.lineStyle(1.5, shade, 1);
    g.strokeRect(4, 26, 42, 26);
    g.lineStyle(1.5, 0x6e4a2b, 1);
    g.lineBetween(25, 8, 25, 0);
    g.fillStyle(0xd6402b, 1);
    g.fillTriangle(25, 0, 25, 6, 33, 3);
  });
  make(scene, 'driftwood', 78, 26, (g) => {
    g.fillStyle(0xb7a28a, 1);
    g.fillRoundedRect(2, 8, 72, 16, 8);
    g.lineStyle(4, 0xb7a28a, 1);
    g.lineBetween(52, 10, 66, 1);
    g.lineStyle(1.5, 0x8c7860, 1);
    g.strokeRoundedRect(2, 8, 72, 16, 8);
    g.lineBetween(10, 14, 44, 14);
    g.lineBetween(18, 19, 60, 19);
  });
  make(scene, 'umbrella', 124, 46, (g) => {
    const colors = [0xd6402b, 0xfff4e0];
    for (let i = 0; i < 6; i++) {
      g.fillStyle(colors[i % 2], 1);
      const a0 = Math.PI + (i * Math.PI) / 6;
      const a1 = Math.PI + ((i + 1) * Math.PI) / 6;
      g.slice(62, 44, 60, a0, a1, false);
      g.fillPath();
    }
    g.lineStyle(2, 0x9c2c1e, 1);
    g.beginPath();
    g.arc(62, 44, 60, Math.PI, Math.PI * 2);
    g.strokePath();
    g.fillStyle(0x6e4a2b, 1);
    g.fillCircle(62, 2, 3);
  });
  make(scene, 'umbrella-pole', 6, 100, (g) => {
    g.fillStyle(0x8a6a4a, 1);
    g.fillRect(1, 0, 4, 100);
  });
  make(scene, 'crab', 42, 28, (g) => {
    const c = 0xe0603a;
    g.fillStyle(c, 1);
    g.fillEllipse(21, 18, 26, 14);
    g.lineStyle(2.5, c, 1);
    for (const s of [-1, 1]) {
      g.lineBetween(21 + s * 10, 20, 21 + s * 17, 27);
      g.lineBetween(21 + s * 7, 22, 21 + s * 12, 28);
      g.lineBetween(21 + s * 11, 14, 21 + s * 16, 6);
    }
    g.fillStyle(c, 1);
    g.fillCircle(5, 6, 5);
    g.fillCircle(37, 6, 5);
    g.lineStyle(1.5, 0x9c3b22, 1);
    g.lineBetween(17, 12, 16, 5);
    g.lineBetween(25, 12, 26, 5);
    g.fillStyle(0x111111, 1);
    g.fillCircle(16, 5, 2);
    g.fillCircle(26, 5, 2);
  });
  make(scene, 'gull-0', 44, 24, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(22, 15, 26, 10);
    g.fillCircle(9, 12, 5);
    g.fillStyle(0xb8c0cc, 1);
    g.fillTriangle(16, 13, 30, 13, 26, 0); // wing up
    g.fillStyle(0x333333, 1);
    g.fillCircle(8, 11, 1.2);
    g.fillStyle(0xf2b33a, 1);
    g.fillTriangle(4, 12, 0, 13, 4, 14);
  });
  make(scene, 'gull-1', 44, 24, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(22, 11, 26, 10);
    g.fillCircle(9, 8, 5);
    g.fillStyle(0xb8c0cc, 1);
    g.fillTriangle(16, 11, 30, 11, 24, 24); // wing down
    g.fillStyle(0x333333, 1);
    g.fillCircle(8, 7, 1.2);
    g.fillStyle(0xf2b33a, 1);
    g.fillTriangle(4, 8, 0, 9, 4, 10);
  });

  // ---------- Shared ----------
  make(scene, 'shadow', 64, 14, (g) => {
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(32, 7, 64, 14);
  });
  make(scene, 'rays', 400, 400, (g) => {
    g.fillStyle(0xffffff, 0.16);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const b = a + Math.PI / 32;
      g.fillTriangle(200, 200, 200 + Math.cos(a) * 200, 200 + Math.sin(a) * 200, 200 + Math.cos(b) * 200, 200 + Math.sin(b) * 200);
    }
  });
}
