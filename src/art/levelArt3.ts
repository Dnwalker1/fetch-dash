import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

/**
 * Art for Levels 7 to 12: Autumn Orchard, Desert Canyon, Sunny Farm,
 * Blossom Garden, Jungle Falls and Fireworks Pier. Background layers are
 * GAME_WIDTH wide and tile sideways, so anything near an edge is drawn
 * again one width over, and hill lines use waves that repeat every width.
 */

type G = Phaser.GameObjects.Graphics;
const W = GAME_WIDTH;
const TAU = Math.PI * 2;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

function wrap(draw: (dx: number) => void): void {
  for (const dx of [-W, 0, W]) draw(dx);
}

/** A rolling ridge filled down to the bottom; the waves repeat exactly every width. */
function ridge(g: G, color: number, h: number, base: number, waves: [number, number, number][]): void {
  const pts: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: h }];
  for (let x = 0; x <= W; x += 8) {
    let y = base;
    for (const [amp, n, phase] of waves) y += amp * Math.sin((x / W) * TAU * n + phase);
    pts.push({ x, y });
  }
  pts.push({ x: W, y: h });
  g.fillStyle(color, 1);
  g.fillPoints(pts, true);
}

/** A round tree: trunk and a crown of a few circles. */
function roundTree(g: G, x: number, ground: number, size: number, crown: number[], trunk = 0x6b4423): void {
  g.fillStyle(trunk, 1);
  g.fillRect(x - size * 0.09, ground - size * 0.9, size * 0.18, size * 0.9);
  const r = size * 0.42;
  g.fillStyle(crown[0], 1);
  g.fillCircle(x, ground - size * 1.15, r);
  g.fillCircle(x - r * 0.7, ground - size * 0.95, r * 0.75);
  g.fillCircle(x + r * 0.7, ground - size * 0.95, r * 0.75);
  if (crown[1] !== undefined) {
    g.fillStyle(crown[1], 1);
    g.fillCircle(x - r * 0.25, ground - size * 1.28, r * 0.5);
  }
}

export function makeLevelArt3(scene: Phaser.Scene): void {
  // Leafy branches and treetops in each season's colors (dark, mid, light)
  const branch = (key: string, [dark, mid, light]: number[]) =>
    make(scene, key, 110, 50, (g) => {
      g.lineStyle(8, 0x6b4423, 1);
      g.lineBetween(110, 10, 6, 16);
      g.lineStyle(4, 0x6b4423, 1);
      g.lineBetween(70, 12, 52, 30);
      g.lineBetween(36, 14, 20, 30);
      const leaves: [number, number, number, number][] = [
        [10, 24, 13, dark], [28, 34, 14, mid], [48, 36, 13, dark], [64, 30, 13, mid], [84, 24, 12, dark],
        [22, 18, 10, light], [56, 20, 10, light], [94, 16, 9, mid], [40, 26, 11, mid],
      ];
      for (const [x, y, r, c] of leaves) {
        g.fillStyle(c, 1);
        g.fillCircle(x, y, r);
      }
    });
  const canopy = (key: string, [dark, mid, light]: number[]) =>
    make(scene, key, 180, 110, (g) => {
      const puffs: [number, number, number, number][] = [
        [30, 60, 34, dark], [90, 70, 40, mid], [150, 58, 32, dark], [60, 36, 30, mid], [120, 34, 32, light], [90, 30, 26, mid],
      ];
      for (const [x, y, r, c] of puffs) {
        g.fillStyle(c, 1);
        g.fillCircle(x, y, r);
      }
    });
  const autumn = [0xb5552a, 0xd9792a, 0xe8b030];
  const blossom = [0xe08aa8, 0xf4b6c8, 0xfbdde6];
  const jungle = [0x2f6a3a, 0x3f8a4a, 0x5aa85a];
  branch('autumnbranch', autumn);
  canopy('canopy-autumn', autumn);
  branch('blossombranch', blossom);
  canopy('canopy-blossom', blossom);
  canopy('canopy-jungle', jungle);

  // ---------- Level 7: Autumn Orchard ----------
  make(scene, 'autumnhills', W, 220, (g) => {
    ridge(g, 0xd9b27a, 220, 90, [[22, 2, 0.3], [10, 5, 1.1]]);
    ridge(g, 0xc79a5a, 220, 130, [[18, 3, 2.0], [8, 7, 0.4]]);
    const colors = [0xd9692a, 0xc9452c, 0xe8b030, 0xb5552a];
    for (let i = 0; i < 26; i++) {
      const x = (i * 37 + (i % 3) * 11) % W;
      const y = 120 + 22 * Math.sin((x / W) * TAU * 3 + 2.0) + 8 * Math.sin((x / W) * TAU * 7 + 0.4) + 6;
      wrap((dx) => {
        g.fillStyle(colors[i % colors.length], 1);
        g.fillCircle(x + dx, y, 9 + (i % 3) * 2);
      });
    }
    ridge(g, 0xa98a4a, 220, 180, [[10, 4, 0.8], [5, 9, 2.2]]);
  });
  make(scene, 'appletrees', W, 170, (g) => {
    const trees: [number, number][] = [[60, 120], [230, 140], [420, 125], [610, 145], [800, 130]];
    for (const [x, s] of trees) {
      wrap((dx) => {
        roundTree(g, x + dx, 165, s * 0.95, [x % 2 ? 0x5f8a3a : 0x6f9a42, 0x86ad4f], 0x6b4a30);
        g.fillStyle(0xd23a2a, 1);
        for (let k = 0; k < 9; k++) {
          const a = (k / 9) * TAU + x;
          g.fillCircle(x + dx + Math.cos(a) * s * 0.3, 165 - s * 1.1 + Math.sin(a) * s * 0.22, 4);
        }
      });
    }
    // a split-rail fence and a basket of apples
    g.fillStyle(0x8a6a44, 1);
    g.fillRect(0, 140, W, 4);
    g.fillRect(0, 154, W, 4);
    for (let x = 10; x < W; x += 64) g.fillRect(x, 132, 6, 38);
    wrap((dx) => {
      g.fillStyle(0x9c6b3c, 1);
      g.fillRoundedRect(dx + 330, 150, 36, 20, 4);
      g.fillStyle(0xd23a2a, 1);
      for (const ax of [338, 347, 356]) g.fillCircle(dx + ax, 150, 5);
    });
  });
  make(scene, 'haybale', 56, 40, (g) => {
    g.fillStyle(0xe2bf5c, 1);
    g.fillRoundedRect(0, 2, 56, 38, 8);
    g.lineStyle(2, 0xc49a3c, 1);
    for (let x = 8; x < 52; x += 7) g.lineBetween(x, 6, x - 3, 36);
    g.fillStyle(0x9c6b3c, 1);
    g.fillRect(14, 2, 4, 38);
    g.fillRect(38, 2, 4, 38);
  });
  make(scene, 'pumpkin', 40, 34, (g) => {
    g.fillStyle(0xe07a24, 1);
    g.fillEllipse(12, 20, 20, 26);
    g.fillEllipse(28, 20, 20, 26);
    g.fillStyle(0xf09a3a, 1);
    g.fillEllipse(20, 20, 18, 28);
    g.lineStyle(1.5, 0xb85a18, 1);
    g.strokeEllipse(20, 20, 18, 28);
    g.fillStyle(0x4f7a2a, 1);
    g.fillRect(18, 2, 5, 8);
    g.fillEllipse(26, 6, 10, 5);
  });
  make(scene, 'chipmunk', 36, 26, (g) => {
    g.fillStyle(0xb5784a, 1);
    g.fillEllipse(20, 16, 22, 12);
    g.fillCircle(8, 12, 7);
    g.fillStyle(0x5e3a22, 1);
    g.fillRect(14, 11, 14, 2);
    g.fillStyle(0xf0dcc0, 1);
    g.fillRect(14, 14, 14, 2);
    g.fillStyle(0xb5784a, 1);
    g.fillEllipse(32, 9, 8, 14);
    g.fillStyle(0x111111, 1);
    g.fillCircle(5, 11, 1.5);
    g.fillStyle(0x7a4a2a, 1);
    g.fillRect(12, 21, 3, 5);
    g.fillRect(24, 21, 3, 5);
  });
  make(scene, 'mouse', 32, 18, (g) => {
    g.fillStyle(0x9a9aa4, 1);
    g.fillEllipse(17, 11, 20, 11);
    g.fillEllipse(6, 10, 10, 8);
    g.fillStyle(0xe8b4b8, 1);
    g.fillCircle(9, 4, 3.5);
    g.fillCircle(1.5, 10, 1.5);
    g.lineStyle(1.5, 0xe8b4b8, 1);
    g.lineBetween(26, 12, 32, 6);
    g.fillStyle(0x111111, 1);
    g.fillCircle(5, 9, 1.2);
  });
  const crow = (key: string, up: boolean) =>
    make(scene, key, 44, 24, (g) => {
      g.fillStyle(0x23232e, 1);
      g.fillEllipse(22, 14, 24, 10);
      g.fillCircle(9, 11, 5.5);
      g.fillTriangle(32, 12, 44, 8, 42, 18);
      if (up) g.fillTriangle(15, 12, 31, 12, 26, 0);
      else g.fillTriangle(15, 13, 31, 13, 25, 24);
      g.fillStyle(0x6b6b6b, 1);
      g.fillTriangle(4, 10, 0, 12, 4, 13);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(8, 10, 1.2);
    });
  crow('crow-0', true);
  crow('crow-1', false);
  make(scene, 'leaf', 12, 8, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(6, 4, 12, 6);
  });

  // ---------- Level 8: Desert Canyon ----------
  make(scene, 'mesas', W, 240, (g) => {
    const mesa = (x: number, w: number, top: number, c: number, band: number) =>
      wrap((dx) => {
        g.fillStyle(c, 1);
        g.fillPoints([{ x: dx + x - w / 2 - 30, y: 240 }, { x: dx + x - w / 2, y: top }, { x: dx + x + w / 2, y: top }, { x: dx + x + w / 2 + 30, y: 240 }], true);
        g.fillStyle(band, 1);
        for (let y = top + 18; y < 230; y += 26) g.fillRect(dx + x - w / 2 - ((y - top) * 30) / (240 - top), y, w + ((y - top) * 60) / (240 - top), 5);
      });
    mesa(120, 160, 90, 0xd99a7a, 0xc98a6a);
    mesa(560, 220, 70, 0xd99a7a, 0xc98a6a);
    mesa(330, 120, 130, 0xc06a44, 0xa85a38);
    mesa(800, 150, 115, 0xc06a44, 0xa85a38);
    ridge(g, 0xb85f3c, 240, 205, [[10, 3, 0.5], [6, 8, 1.7]]);
  });
  make(scene, 'cacti', W, 160, (g) => {
    const saguaro = (x: number, h: number) =>
      wrap((dx) => {
        const bx = x + dx;
        g.fillStyle(0x4f8a4a, 1);
        g.fillRoundedRect(bx - 9, 160 - h, 18, h, 9);
        g.fillRoundedRect(bx - 30, 160 - h * 0.62, 10, h * 0.32, 5);
        g.fillRect(bx - 30, 160 - h * 0.34, 22, 9);
        g.fillRoundedRect(bx + 20, 160 - h * 0.78, 10, h * 0.36, 5);
        g.fillRect(bx + 8, 160 - h * 0.46, 22, 9);
        g.fillStyle(0x6aa85f, 1);
        g.fillRect(bx - 3, 160 - h + 8, 3, h - 16);
      });
    saguaro(90, 120);
    saguaro(380, 140);
    saguaro(700, 110);
    wrap((dx) => {
      g.fillStyle(0x5f9a52, 1);
      g.fillEllipse(dx + 240, 146, 30, 22);
      g.fillEllipse(dx + 256, 132, 20, 16);
      g.fillStyle(0xe85a8a, 1);
      g.fillCircle(dx + 258, 124, 3.5);
      g.fillStyle(0x9a6a4a, 1);
      g.fillEllipse(dx + 540, 152, 46, 18);
      g.fillEllipse(dx + 860, 154, 32, 14);
    });
  });
  make(scene, 'cactus', 34, 52, (g) => {
    g.fillStyle(0x4f8a4a, 1);
    g.fillRoundedRect(11, 0, 13, 52, 6);
    g.fillRoundedRect(0, 14, 8, 20, 4);
    g.fillRect(0, 28, 14, 7);
    g.fillRoundedRect(27, 8, 7, 22, 3);
    g.fillRect(20, 24, 14, 7);
    g.fillStyle(0x6aa85f, 1);
    g.fillRect(16, 4, 2, 44);
    g.fillStyle(0xf4efe0, 1);
    for (const [x, y] of [[13, 10], [21, 18], [13, 30], [21, 40], [3, 20], [30, 14]]) g.fillRect(x, y, 2, 2);
  });
  make(scene, 'tumbleweed', 40, 38, (g) => {
    g.lineStyle(2, 0xa8844e, 1);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      g.strokeEllipse(20 + Math.cos(a) * 4, 19 + Math.sin(a) * 4, 30, 26);
    }
    g.lineStyle(1.5, 0x8a6a3a, 1);
    g.strokeCircle(20, 19, 17);
  });
  make(scene, 'arch', 130, 44, (g) => {
    g.fillStyle(0xc06a44, 1);
    g.fillRoundedRect(0, 0, 130, 34, 12);
    g.fillStyle(0xa85a38, 1);
    g.fillRect(6, 12, 118, 4);
    g.fillRect(10, 24, 110, 3);
    g.fillStyle(0xd99a7a, 1);
    g.fillRect(14, 4, 60, 3);
    g.fillStyle(0xc06a44, 1);
    g.fillEllipse(65, 34, 120, 16);
  });
  make(scene, 'lizard', 46, 18, (g) => {
    g.fillStyle(0x6aa84a, 1);
    g.fillEllipse(18, 10, 22, 9);
    g.fillEllipse(5, 9, 10, 7);
    g.fillTriangle(27, 7, 46, 11, 27, 13);
    g.lineStyle(2.5, 0x6aa84a, 1);
    g.lineBetween(12, 12, 8, 18);
    g.lineBetween(14, 8, 10, 2);
    g.lineBetween(24, 12, 28, 18);
    g.lineBetween(24, 8, 28, 2);
    g.fillStyle(0xe8c547, 1);
    for (const x of [14, 19, 24]) g.fillCircle(x, 9, 1.5);
    g.fillStyle(0x111111, 1);
    g.fillCircle(3, 8, 1.2);
  });
  const hawk = (key: string, up: boolean) =>
    make(scene, key, 60, 28, (g) => {
      g.fillStyle(0x7a5232, 1);
      g.fillEllipse(30, 15, 30, 10);
      g.fillCircle(14, 13, 6);
      g.fillStyle(0x5e3e26, 1);
      if (up) {
        g.fillTriangle(20, 13, 44, 13, 52, 0);
        g.fillTriangle(20, 13, 40, 13, 8, 0);
      } else {
        g.fillTriangle(20, 15, 44, 15, 54, 28);
        g.fillTriangle(20, 15, 40, 15, 6, 28);
      }
      g.fillStyle(0xe8d8b8, 1);
      g.fillTriangle(44, 13, 58, 10, 58, 19);
      g.fillStyle(0xe8b030, 1);
      g.fillTriangle(9, 12, 4, 14, 9, 15);
      g.fillStyle(0x111111, 1);
      g.fillCircle(12, 12, 1.4);
    });
  hawk('hawk-0', true);
  hawk('hawk-1', false);

  // ---------- Level 9: Sunny Farm ----------
  make(scene, 'fields', W, 200, (g) => {
    ridge(g, 0xa8d07a, 200, 80, [[16, 2, 0.6], [6, 5, 2.1]]);
    // a silo and a farmhouse far off
    wrap((dx) => {
      g.fillStyle(0xb9c4cc, 1);
      g.fillRect(dx + 700, 40, 26, 50);
      g.fillEllipse(dx + 713, 40, 26, 16);
      g.fillStyle(0xe8e0d0, 1);
      g.fillRect(dx + 200, 62, 50, 30);
      g.fillStyle(0x8a5a4a, 1);
      g.fillTriangle(dx + 194, 64, dx + 225, 44, dx + 256, 64);
    });
    ridge(g, 0xd9c45a, 200, 115, [[14, 3, 1.3], [5, 7, 0.2]]);
    g.lineStyle(1.5, 0xc4ae48, 1);
    for (let x = 0; x < W; x += 14) g.lineBetween(x, 135, x + 22, 200);
    ridge(g, 0x8cc060, 200, 150, [[12, 2, 2.4], [5, 6, 1.0]]);
    g.lineStyle(1.5, 0x79ab50, 1);
    for (let y = 165; y < 200; y += 9) g.lineBetween(0, y, W, y);
  });
  make(scene, 'barnyard', W, 190, (g) => {
    wrap((dx) => {
      // red barn
      const bx = dx + 120;
      g.fillStyle(0xb5382e, 1);
      g.fillRect(bx, 90, 150, 100);
      g.fillPoints([{ x: bx - 10, y: 92 }, { x: bx + 30, y: 50 }, { x: bx + 120, y: 50 }, { x: bx + 160, y: 92 }], true);
      g.fillStyle(0xf4efe0, 1);
      g.fillRect(bx + 50, 120, 50, 70);
      g.fillStyle(0xb5382e, 1);
      g.fillRect(bx + 54, 124, 42, 66);
      g.lineStyle(3, 0xf4efe0, 1);
      g.lineBetween(bx + 54, 124, bx + 96, 190);
      g.lineBetween(bx + 96, 124, bx + 54, 190);
      g.fillStyle(0xf4efe0, 1);
      g.fillRect(bx + 62, 70, 26, 20);
      g.fillStyle(0x6b2a22, 1);
      g.fillRect(bx + 66, 74, 18, 16);
      // windmill
      const wx = dx + 560;
      g.lineStyle(4, 0x8a8f97, 1);
      g.lineBetween(wx - 14, 190, wx, 60);
      g.lineBetween(wx + 14, 190, wx, 60);
      g.lineBetween(wx - 9, 140, wx + 9, 140);
      g.lineBetween(wx - 5, 100, wx + 5, 100);
      g.fillStyle(0xd0d4da, 1);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        g.fillTriangle(wx, 56, wx + Math.cos(a) * 34, 56 + Math.sin(a) * 34, wx + Math.cos(a + 0.3) * 34, 56 + Math.sin(a + 0.3) * 34);
      }
      g.fillStyle(0x6b7078, 1);
      g.fillCircle(wx, 56, 5);
      // haystack and a tree
      g.fillStyle(0xe2bf5c, 1);
      g.fillEllipse(dx + 400, 172, 70, 46);
      g.fillEllipse(dx + 400, 154, 44, 30);
      roundTree(g, dx + 820, 190, 120, [0x5f9a4a, 0x7ab85a]);
    });
    g.fillStyle(0xf4efe0, 1);
    g.fillRect(0, 160, W, 4);
    g.fillRect(0, 176, W, 4);
    for (let x = 6; x < W; x += 48) g.fillRect(x, 154, 5, 36);
  });
  make(scene, 'trough', 70, 26, (g) => {
    g.fillStyle(0x8a6a44, 1);
    g.fillRect(2, 18, 6, 8);
    g.fillRect(62, 18, 6, 8);
    g.fillStyle(0x9c7a4c, 1);
    g.fillPoints([{ x: 0, y: 2 }, { x: 70, y: 2 }, { x: 62, y: 20 }, { x: 8, y: 20 }], true);
    g.fillStyle(0x5aa7e6, 1);
    g.fillRect(4, 3, 62, 5);
    g.lineStyle(1.5, 0x6b4a30, 1);
    g.strokeRect(0, 2, 70, 1);
  });
  make(scene, 'clothesline', 130, 44, (g) => {
    g.lineStyle(2, 0x6b6b6b, 1);
    g.lineBetween(0, 3, 130, 3);
    const sheets: [number, number, number][] = [[6, 30, 0xf4efe0], [40, 26, 0x6fb8e0], [70, 30, 0xe8a0b4], [102, 24, 0xf2d45a]];
    for (const [x, w, c] of sheets) {
      g.fillStyle(c, 1);
      g.fillRect(x, 3, w, 36);
      g.fillTriangle(x, 39, x + w / 2, 44, x + w, 39);
      g.fillStyle(0x9c7a4c, 1);
      g.fillRect(x + 3, 0, 3, 7);
      g.fillRect(x + w - 6, 0, 3, 7);
    }
  });
  make(scene, 'chicken', 36, 36, (g) => {
    g.fillStyle(0xf8f4ea, 1);
    g.fillEllipse(20, 20, 26, 18);
    g.fillCircle(9, 11, 7);
    g.fillTriangle(30, 14, 36, 6, 34, 20);
    g.fillStyle(0xd6402b, 1);
    g.fillCircle(8, 4, 3);
    g.fillCircle(11, 4, 2.5);
    g.fillEllipse(5, 16, 3, 5);
    g.fillStyle(0xe8b030, 1);
    g.fillTriangle(3, 10, -2, 12, 3, 13);
    g.lineStyle(2, 0xe8b030, 1);
    g.lineBetween(16, 28, 13, 36);
    g.lineBetween(23, 28, 25, 36);
    g.fillStyle(0x111111, 1);
    g.fillCircle(7, 10, 1.3);
    g.fillStyle(0xe6ddc8, 1);
    g.fillEllipse(22, 19, 12, 7);
  });

  // ---------- Level 10: Blossom Garden ----------
  make(scene, 'blossoms', W, 180, (g) => {
    const pinks = [0xf4b6c8, 0xf9cdd9, 0xeaa0b8];
    const tree = (x: number, s: number) =>
      wrap((dx) => {
        const bx = x + dx;
        g.lineStyle(7, 0x5b3b2e, 1);
        g.lineBetween(bx, 180, bx - 4, 180 - s * 0.6);
        g.lineStyle(4, 0x5b3b2e, 1);
        g.lineBetween(bx - 4, 180 - s * 0.55, bx - 30, 180 - s * 0.85);
        g.lineBetween(bx - 2, 180 - s * 0.6, bx + 28, 180 - s * 0.9);
        for (let k = 0; k < 7; k++) {
          g.fillStyle(pinks[k % 3], 1);
          g.fillCircle(bx - 40 + k * 13, 180 - s * 0.9 - Math.sin((k / 6) * Math.PI) * 22, 20 + (k % 2) * 6);
        }
      });
    tree(110, 150);
    tree(470, 170);
    tree(780, 140);
    // a stone lantern and a little red bridge
    wrap((dx) => {
      const lx = dx + 300;
      g.fillStyle(0xa8a8a0, 1);
      g.fillRect(lx - 4, 140, 8, 40);
      g.fillRect(lx - 12, 128, 24, 14);
      g.fillTriangle(lx - 18, 130, lx, 114, lx + 18, 130);
      g.fillStyle(0xffe6a8, 1);
      g.fillRect(lx - 6, 131, 12, 8);
      const bx = dx + 620;
      g.lineStyle(6, 0xc8402e, 1);
      g.beginPath();
      g.arc(bx, 200, 60, Math.PI * 1.15, Math.PI * 1.85);
      g.strokePath();
      g.lineStyle(3, 0xc8402e, 1);
      g.beginPath();
      g.arc(bx, 190, 60, Math.PI * 1.15, Math.PI * 1.85);
      g.strokePath();
      for (const px of [-40, -14, 14, 40]) g.lineBetween(bx + px, 200 - Math.sqrt(3600 - px * px), bx + px, 190 - Math.sqrt(3600 - px * px));
    });
  });
  make(scene, 'lantern', 30, 46, (g) => {
    g.fillStyle(0x9a9a92, 1);
    g.fillRect(4, 40, 22, 6);
    g.fillRect(11, 26, 8, 14);
    g.fillRect(5, 14, 20, 12);
    g.fillTriangle(0, 15, 15, 2, 30, 15);
    g.fillStyle(0xb8b8b0, 1);
    g.fillCircle(15, 3, 3);
    g.fillStyle(0xffe6a8, 1);
    g.fillRect(10, 17, 10, 7);
  });
  make(scene, 'pond', 150, 16, (g) => {
    g.fillStyle(0x4f8ab0, 1);
    g.fillEllipse(75, 8, 150, 16);
    g.fillStyle(0x7fb4d4, 1);
    g.fillEllipse(55, 6, 70, 5);
    g.fillStyle(0xf28c3a, 1);
    g.fillEllipse(48, 9, 12, 4);
    g.fillStyle(0xf4efe0, 1);
    g.fillEllipse(96, 8, 12, 4);
    g.fillStyle(0x5f9a4a, 1);
    g.fillEllipse(120, 6, 16, 6);
    g.fillStyle(0xf4b6c8, 1);
    g.fillCircle(122, 5, 3);
    g.fillStyle(0x8a8f97, 1);
    g.fillEllipse(6, 11, 12, 8);
    g.fillEllipse(144, 10, 12, 8);
  });
  make(scene, 'petal', 8, 6, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(4, 3, 8, 5);
  });

  // ---------- Level 11: Jungle Falls ----------
  make(scene, 'falls', W, 260, (g) => {
    ridge(g, 0x4f8a6a, 260, 60, [[30, 2, 0.4], [14, 5, 1.6]]);
    // waterfalls pouring down the cliffs
    wrap((dx) => {
      for (const [x, w] of [[220, 34], [640, 48]] as const) {
        g.fillStyle(0xd8f0f8, 1);
        g.fillRect(dx + x, 40, w, 220);
        g.fillStyle(0xa8d8ec, 1);
        for (let k = 0; k < 4; k++) g.fillRect(dx + x + 4 + k * (w / 4), 40, 3, 220);
        g.fillStyle(0xffffff, 0.8);
        g.fillEllipse(dx + x + w / 2, 236, w * 2.6, 30);
      }
    });
    ridge(g, 0x3f7a5a, 260, 150, [[20, 3, 2.2], [8, 7, 0.8]]);
    g.fillStyle(0x5a9a6a, 1);
    for (let i = 0; i < 30; i++) {
      const x = (i * 33) % W;
      wrap((dx) => g.fillCircle(x + dx, 160 + 20 * Math.sin((x / W) * TAU * 3 + 2.2) + 10, 12 + (i % 3) * 3));
    }
  });
  make(scene, 'jungle', W, 200, (g) => {
    const leaf = (x: number, y: number, len: number, ang: number, c: number) => {
      const tip = { x: x + Math.cos(ang) * len, y: y + Math.sin(ang) * len };
      const side = { x: Math.cos(ang + Math.PI / 2) * len * 0.22, y: Math.sin(ang + Math.PI / 2) * len * 0.22 };
      const mid = { x: x + Math.cos(ang) * len * 0.5, y: y + Math.sin(ang) * len * 0.5 };
      g.fillStyle(c, 1);
      g.fillTriangle(x, y, mid.x + side.x, mid.y + side.y, tip.x, tip.y);
      g.fillTriangle(x, y, mid.x - side.x, mid.y - side.y, tip.x, tip.y);
    };
    const plant = (x: number, h: number) =>
      wrap((dx) => {
        const bx = x + dx;
        g.fillStyle(0x6b4a30, 1);
        g.fillRect(bx - 5, 200 - h, 10, h);
        for (let k = 0; k < 7; k++) leaf(bx, 200 - h, 60, -Math.PI / 2 + (k - 3) * 0.5, k % 2 ? 0x2f7a3a : 0x3f9a4a);
        // hanging vines
        g.lineStyle(2, 0x3f7a3a, 1);
        g.lineBetween(bx - 30, 200 - h + 10, bx - 34, 200 - h + 70);
        g.lineBetween(bx + 26, 200 - h + 8, bx + 30, 200 - h + 56);
      });
    plant(100, 150);
    plant(400, 170);
    plant(720, 140);
    // big ferns along the bottom
    for (let x = 0; x < W; x += 70) {
      wrap((dx) => {
        for (let k = 0; k < 5; k++) leaf(x + dx + 20, 200, 44, -Math.PI / 2 + (k - 2) * 0.45, k % 2 ? 0x3f8a3a : 0x4fa84a);
      });
    }
    wrap((dx) => {
      g.fillStyle(0xe8507a, 1);
      g.fillCircle(dx + 260, 176, 6);
      g.fillCircle(dx + 560, 170, 6);
      g.fillStyle(0xf2c14e, 1);
      g.fillCircle(dx + 260, 176, 2);
      g.fillCircle(dx + 560, 170, 2);
    });
  });
  make(scene, 'vines', 110, 56, (g) => {
    g.lineStyle(7, 0x5b3b22, 1);
    g.lineBetween(110, 6, 0, 10);
    g.lineStyle(3, 0x3f8a3a, 1);
    for (let x = 8; x < 108; x += 12) {
      const len = 30 + ((x * 7) % 22);
      g.lineBetween(x, 9, x + 2, 9 + len);
      g.fillStyle(0x4fa84a, 1);
      g.fillEllipse(x + 2, 9 + len, 8, 6);
      g.fillEllipse(x - 2, 9 + len * 0.55, 7, 5);
    }
  });
  make(scene, 'monkey', 40, 38, (g) => {
    g.fillStyle(0x7a5232, 1);
    g.fillEllipse(22, 22, 20, 18);
    g.fillCircle(10, 12, 9);
    g.fillCircle(3, 10, 4);
    g.fillCircle(17, 6, 4);
    g.lineStyle(3, 0x7a5232, 1);
    g.beginPath();
    g.arc(34, 14, 7, Math.PI * 0.5, Math.PI * 1.9);
    g.strokePath();
    g.lineStyle(4, 0x7a5232, 1);
    g.lineBetween(16, 30, 12, 38);
    g.lineBetween(28, 30, 31, 38);
    g.lineBetween(14, 22, 6, 28);
    g.fillStyle(0xe8c8a0, 1);
    g.fillEllipse(9, 14, 11, 9);
    g.fillStyle(0x111111, 1);
    g.fillCircle(7, 11, 1.4);
    g.fillCircle(11, 11, 1.4);
  });
  const parrot = (key: string, up: boolean) =>
    make(scene, key, 48, 30, (g) => {
      g.fillStyle(0xd6402b, 1);
      g.fillEllipse(22, 16, 24, 12);
      g.fillCircle(9, 12, 7);
      g.fillStyle(0x2f6fd0, 1);
      g.fillTriangle(30, 14, 48, 20, 32, 22);
      g.fillStyle(0x3f9a4a, 1);
      if (up) g.fillTriangle(16, 14, 32, 14, 28, 0);
      else g.fillTriangle(16, 15, 32, 15, 26, 30);
      g.fillStyle(0xf2c14e, 1);
      g.fillRect(17, 17, 10, 3);
      g.fillStyle(0xf4efe0, 1);
      g.fillTriangle(4, 9, -1, 14, 5, 16);
      g.fillStyle(0x111111, 1);
      g.fillCircle(8, 10, 1.5);
    });
  parrot('parrot-0', true);
  parrot('parrot-1', false);

  // ---------- Level 12: Fireworks Pier ----------
  make(scene, 'carnival', W, 200, (g) => {
    wrap((dx) => {
      // ferris wheel
      const fx = dx + 620;
      const cy = 90;
      g.lineStyle(4, 0x4a4a6a, 1);
      g.lineBetween(fx - 40, 200, fx, cy);
      g.lineBetween(fx + 40, 200, fx, cy);
      g.lineStyle(3, 0xf2c14e, 1);
      g.strokeCircle(fx, cy, 76);
      g.lineStyle(1.5, 0xf2c14e, 0.8);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        g.lineBetween(fx, cy, fx + Math.cos(a) * 76, cy + Math.sin(a) * 76);
      }
      const cars = [0xe8507a, 0x5ab0e8, 0x7ad06a, 0xf2a03a];
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        g.fillStyle(cars[k % 4], 1);
        g.fillRoundedRect(fx + Math.cos(a) * 76 - 7, cy + Math.sin(a) * 76, 14, 11, 3);
      }
      // striped tents
      for (const [tx, c] of [[150, 0xd6402b], [330, 0x2f6fd0], [860, 0x7a3ab0]] as const) {
        const x0 = dx + tx;
        for (let k = 0; k < 6; k++) {
          g.fillStyle(k % 2 ? 0xf4efe0 : c, 1);
          g.fillRect(x0 - 48 + k * 16, 150, 16, 50);
          g.fillTriangle(x0, 104, x0 - 48 + k * 16, 150, x0 - 32 + k * 16, 150);
        }
        g.fillStyle(0xf2c14e, 1);
        g.fillTriangle(x0, 90, x0 + 14, 96, x0, 102);
        g.fillRect(x0 - 1, 90, 2, 16);
      }
    });
    // strings of lights
    const bulbs = [0xffe08a, 0xff8ab0, 0x8ad8ff, 0xb0ff8a];
    g.lineStyle(1.5, 0x2a2a3a, 1);
    for (let x = 0; x < W; x += 240) {
      g.beginPath();
      for (let k = 0; k <= 24; k++) {
        const px = x + k * 10;
        const py = 40 + 26 * Math.sin((k / 24) * Math.PI);
        if (k === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
      for (let k = 1; k < 24; k += 2) {
        g.fillStyle(bulbs[(k >> 1) % 4], 1);
        g.fillCircle(x + k * 10, 43 + 26 * Math.sin((k / 24) * Math.PI), 3);
      }
    }
  });
  make(scene, 'crate', 40, 40, (g) => {
    g.fillStyle(0xb08a5a, 1);
    g.fillRect(0, 0, 40, 40);
    g.lineStyle(3, 0x7a5a3a, 1);
    g.strokeRect(1.5, 1.5, 37, 37);
    g.lineBetween(3, 3, 37, 37);
    g.lineStyle(1.5, 0x8a6a44, 1);
    g.lineBetween(3, 14, 37, 14);
    g.lineBetween(3, 27, 37, 27);
  });
  make(scene, 'barrel', 34, 44, (g) => {
    g.fillStyle(0x9c6b3c, 1);
    g.fillRoundedRect(2, 0, 30, 44, 8);
    g.fillStyle(0xb5814a, 1);
    g.fillRect(8, 2, 4, 40);
    g.fillStyle(0x4a4a52, 1);
    g.fillRect(2, 8, 30, 4);
    g.fillRect(2, 32, 30, 4);
  });
  make(scene, 'banner', 130, 40, (g) => {
    g.lineStyle(2, 0x2a2a3a, 1);
    g.lineBetween(0, 3, 130, 3);
    const flags = [0xd6402b, 0xf2c14e, 0x2f6fd0, 0x7ad06a, 0xe8507a, 0xf28c3a, 0x7a3ab0];
    for (let k = 0; k < 7; k++) {
      g.fillStyle(flags[k], 1);
      g.fillTriangle(4 + k * 18, 3, 20 + k * 18, 3, 12 + k * 18, 30);
    }
    g.fillStyle(0xffe08a, 1);
    for (let k = 0; k < 8; k++) g.fillCircle(2 + k * 18, 6, 2.5);
  });
  const balloon = (key: string, lean: number) =>
    make(scene, key, 30, 60, (g) => {
      g.lineStyle(1.5, 0xe8e0d0, 1);
      g.lineBetween(15, 34, 15 + lean, 60);
      g.fillStyle(0xe8507a, 1);
      g.fillEllipse(15, 18, 26, 32);
      g.fillTriangle(12, 33, 18, 33, 15, 38);
      g.fillStyle(0xffffff, 0.5);
      g.fillEllipse(9, 11, 6, 10);
    });
  balloon('balloon-0', -4);
  balloon('balloon-1', 4);
}
