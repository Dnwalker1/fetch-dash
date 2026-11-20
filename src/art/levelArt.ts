import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

/**
 * Code-drawn background layers still used by the later levels (mountains,
 * sea) and the sun's rays. Layers are GAME_WIDTH wide and tile sideways, so
 * anything near an edge is drawn again one width over.
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
  // mountains (Fireworks Pier and the levels without painted art)
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

  // the sea (Fireworks Pier)
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

  // ---------- Shared ----------
  make(scene, 'rays', 400, 400, (g) => {
    g.fillStyle(0xffffff, 0.16);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const b = a + Math.PI / 32;
      g.fillTriangle(200, 200, 200 + Math.cos(a) * 200, 200 + Math.sin(a) * 200, 200 + Math.cos(b) * 200, 200 + Math.sin(b) * 200);
    }
  });
}
