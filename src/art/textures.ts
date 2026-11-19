import Phaser from 'phaser';
import { GAME_WIDTH, GROUND_Y } from '../config';

/**
 * All game art is drawn here in code, so there are no image files to manage
 * yet. Later these textures get swapped for Goodwookie artwork (and the
 * player's breed-matched pet) without touching the game logic.
 */

const C = {
  wood: 0xc08a52,
  woodDark: 0x7d5530,
  leaf: 0x4f9a43,
  leafDark: 0x3b7a33,
  leafLight: 0x6fbb5c,
  bark: 0x6b4423,
  water: 0x5aa7e6,
  waterLight: 0xa9d7ff,
  bone: 0xf4e3c1,
  boneDark: 0xc9b088,
  ball: 0xd8e65a,
  ballDark: 0x9aab25,
  squirrel: 0x9a7356,
  squirrelDark: 0x6b4d38,
  bird: 0x3b3b5c,
  grass: 0x6fbf5a,
  grassDark: 0x58a446,
  dirt: 0xb98b5a,
};

type G = Phaser.GameObjects.Graphics;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function makeTextures(scene: Phaser.Scene): void {
  // ---- Obstacles ----
  make(scene, 'fence', 34, 50, (g) => {
    g.fillStyle(C.wood, 1);
    g.lineStyle(2, C.woodDark, 1);
    for (const x of [3, 21]) {
      g.fillRect(x, 8, 10, 42);
      g.fillTriangle(x, 8, x + 5, 0, x + 10, 8);
      g.strokeRect(x, 8, 10, 42);
    }
    g.fillRect(0, 16, 34, 6);
    g.strokeRect(0, 16, 34, 6);
    g.fillRect(0, 34, 34, 6);
    g.strokeRect(0, 34, 34, 6);
  });
  make(scene, 'puddle', 90, 12, (g) => {
    g.fillStyle(C.water, 1);
    g.fillEllipse(45, 6, 90, 12);
    g.fillStyle(C.waterLight, 1);
    g.fillEllipse(30, 4, 26, 3);
    g.fillEllipse(62, 7, 14, 2);
  });
  make(scene, 'branch', 110, 50, (g) => {
    g.lineStyle(8, C.bark, 1);
    g.lineBetween(110, 10, 6, 16);
    g.lineStyle(4, C.bark, 1);
    g.lineBetween(70, 12, 52, 30);
    g.lineBetween(36, 14, 20, 30);
    const leaves: [number, number, number, number][] = [
      [10, 24, 13, C.leafDark], [28, 34, 14, C.leaf], [48, 36, 13, C.leafDark],
      [64, 30, 13, C.leaf], [84, 24, 12, C.leafDark], [22, 18, 10, C.leafLight],
      [56, 20, 10, C.leafLight], [94, 16, 9, C.leaf], [40, 26, 11, C.leaf],
    ];
    for (const [x, y, r, c] of leaves) {
      g.fillStyle(c, 1);
      g.fillCircle(x, y, r);
    }
  });
  make(scene, 'trunk', 26, GROUND_Y - 75, (g) => {
    g.fillStyle(C.bark, 1);
    g.fillRect(0, 0, 26, GROUND_Y - 75);
    g.lineStyle(2, 0x553519, 1);
    for (let y = 20; y < GROUND_Y - 80; y += 46) {
      g.lineBetween(7, y, 9, y + 18);
      g.lineBetween(18, y + 24, 16, y + 40);
    }
  });
  make(scene, 'canopy', 180, 110, (g) => {
    const puffs: [number, number, number, number][] = [
      [30, 60, 34, C.leafDark], [90, 70, 40, C.leaf], [150, 58, 32, C.leafDark],
      [60, 36, 30, C.leaf], [120, 34, 32, C.leafLight], [90, 30, 26, C.leaf],
    ];
    for (const [x, y, r, c] of puffs) {
      g.fillStyle(c, 1);
      g.fillCircle(x, y, r);
    }
  });

  // ---- Pickups ----
  make(scene, 'bone', 24, 14, (g) => {
    g.fillStyle(C.bone, 1);
    g.lineStyle(1.5, C.boneDark, 1);
    g.fillRect(5, 4, 14, 6);
    for (const [x, y] of [[4, 4], [4, 10], [20, 4], [20, 10]]) {
      g.fillCircle(x, y, 4);
    }
    g.strokeRoundedRect(0.75, 0.75, 22.5, 12.5, 5);
  });
  make(scene, 'ball', 28, 28, (g) => {
    g.fillStyle(C.ball, 1);
    g.fillCircle(14, 14, 13);
    g.lineStyle(2, 0xffffff, 1);
    g.beginPath();
    g.arc(2, 14, 11, -1.1, 1.1);
    g.strokePath();
    g.beginPath();
    g.arc(26, 14, 11, Math.PI - 1.1, Math.PI + 1.1);
    g.strokePath();
    g.lineStyle(2, C.ballDark, 1);
    g.strokeCircle(14, 14, 13);
  });

  make(scene, 'fish', 26, 14, (g) => {
    g.fillStyle(0xf28c5a, 1);
    g.fillEllipse(11, 7, 20, 12);
    g.fillTriangle(19, 7, 26, 1, 26, 13);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(6, 5.5, 1.5);
    g.lineStyle(1.5, 0xc0622f, 1);
    g.strokeEllipse(11, 7, 20, 12);
  });

  // ---- Critters ----
  make(scene, 'butterfly-0', 26, 22, (g) => {
    g.fillStyle(0xf2a33a, 1);
    g.fillEllipse(7, 7, 12, 12);
    g.fillEllipse(19, 7, 12, 12);
    g.fillStyle(0xe0782a, 1);
    g.fillEllipse(8, 16, 9, 9);
    g.fillEllipse(18, 16, 9, 9);
    g.fillStyle(0x2b1a0d, 1);
    g.fillRect(12, 4, 2, 16);
  });
  make(scene, 'butterfly-1', 26, 22, (g) => {
    g.fillStyle(0xf2a33a, 1);
    g.fillEllipse(9, 9, 6, 12);
    g.fillEllipse(17, 9, 6, 12);
    g.fillStyle(0xe0782a, 1);
    g.fillEllipse(10, 16, 5, 8);
    g.fillEllipse(16, 16, 5, 8);
    g.fillStyle(0x2b1a0d, 1);
    g.fillRect(12, 4, 2, 16);
  });
  make(scene, 'squirrel', 44, 32, (g) => {
    // facing left; big bushy tail on the right
    g.fillStyle(C.squirrelDark, 1);
    g.fillCircle(34, 12, 11);
    g.fillCircle(38, 22, 8);
    g.fillStyle(C.squirrel, 1);
    g.fillEllipse(20, 22, 22, 14);
    g.fillCircle(9, 16, 7);
    g.fillTriangle(9, 8, 12, 4, 13, 10);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(6, 15, 1.6);
    g.fillStyle(C.squirrelDark, 1);
    g.fillRect(12, 27, 4, 5);
    g.fillRect(24, 27, 4, 5);
  });
  make(scene, 'bird-0', 40, 22, (g) => {
    g.fillStyle(C.bird, 1);
    g.fillTriangle(14, 12, 24, 12, 18, 0); // wing up
    g.fillEllipse(20, 14, 24, 9);
    g.fillCircle(8, 12, 5);
    g.fillStyle(0xf2a33a, 1);
    g.fillTriangle(3, 12, 0, 13, 4, 14);
  });
  make(scene, 'bird-1', 40, 22, (g) => {
    g.fillStyle(C.bird, 1);
    g.fillEllipse(20, 10, 24, 9);
    g.fillTriangle(14, 10, 24, 10, 20, 22); // wing down
    g.fillCircle(8, 8, 5);
    g.fillStyle(0xf2a33a, 1);
    g.fillTriangle(3, 8, 0, 9, 4, 10);
  });
  make(scene, 'gopher', 26, 28, (g) => {
    g.fillStyle(0x9a7b5c, 1);
    g.fillRoundedRect(1, 4, 24, 24, 10);
    g.fillCircle(5, 6, 4);
    g.fillCircle(21, 6, 4);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(9, 12, 2);
    g.fillCircle(17, 12, 2);
    g.fillStyle(0xffffff, 1);
    g.fillRect(11, 18, 4, 4);
  });

  // ---- Backgrounds (tile horizontally) ----
  make(scene, 'clouds', GAME_WIDTH, 160, (g) => {
    g.fillStyle(0xffffff, 0.9);
    const clouds: [number, number, number][] = [[120, 50, 1], [430, 100, 0.8], [700, 40, 1.1], [880, 120, 0.7]];
    for (const [x, y, s] of clouds) {
      g.fillEllipse(x, y, 90 * s, 34 * s);
      g.fillEllipse(x - 30 * s, y + 8 * s, 60 * s, 26 * s);
      g.fillEllipse(x + 32 * s, y + 6 * s, 64 * s, 28 * s);
    }
  });
  make(scene, 'hills', GAME_WIDTH, 220, (g) => {
    const hill = (cx: number, w: number, h: number, c: number) => {
      g.fillStyle(c, 1);
      for (const dx of [-GAME_WIDTH, 0, GAME_WIDTH]) g.fillEllipse(cx + dx, 220, w, h * 2);
    };
    hill(160, 700, 150, 0xa8dc96);
    hill(620, 820, 120, 0x9fd88c);
    hill(900, 520, 170, 0xa8dc96);
  });
  make(scene, 'bushes', GAME_WIDTH, 150, (g) => {
    const tree = (x: number, h: number) => {
      g.fillStyle(0x7a5232, 1);
      g.fillRect(x - 6, 150 - h, 12, h);
      g.fillStyle(0x5aa64a, 1);
      g.fillCircle(x, 150 - h, 34);
      g.fillCircle(x - 24, 150 - h + 14, 24);
      g.fillCircle(x + 24, 150 - h + 14, 24);
    };
    tree(140, 90);
    tree(620, 110);
    g.fillStyle(0x66b452, 1);
    for (const [x, r] of [[40, 26], [300, 30], [340, 22], [480, 24], [800, 32], [850, 22]] as const) {
      g.fillCircle(x, 150, r);
    }
  });
  make(scene, 'ground', 128, 100, (g) => {
    g.fillStyle(C.grass, 1);
    g.fillRect(0, 0, 128, 100);
    g.fillStyle(C.dirt, 1);
    g.fillRect(0, 18, 128, 30);
    g.fillStyle(0xa77b4d, 1);
    g.fillCircle(20, 30, 3);
    g.fillCircle(70, 38, 2);
    g.fillCircle(110, 26, 2.5);
    g.fillStyle(C.grassDark, 1);
    for (const x of [8, 40, 76, 104]) {
      g.fillTriangle(x, 8, x + 4, 0, x + 8, 8);
    }
    g.fillRect(0, 0, 128, 3);
    for (const x of [16, 56, 96]) g.fillTriangle(x, 64, x + 4, 56, x + 8, 64);
  });
}
