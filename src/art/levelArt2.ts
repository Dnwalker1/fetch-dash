import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

/**
 * Art for Level 4 (Main Street at dusk), Level 5 (Rainy Riverside) and
 * Level 6 (Snowy Night). Background layers are GAME_WIDTH wide and tile
 * sideways, so shapes near an edge are drawn again one width over.
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

function wrap(draw: (dx: number) => void): void {
  for (const dx of [-W, 0, W]) draw(dx);
}

/** A tiny seeded random, so the same buildings come out every time. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

export function makeLevelArt2(scene: Phaser.Scene): void {
  // ---------- Level 4: Main Street at dusk ----------
  make(scene, 'town', W, 240, (g) => {
    const rand = seeded(11);
    // Far row: hazy blocks
    let x = 0;
    while (x < W) {
      const w = 40 + rand() * 60;
      const h = 70 + rand() * 80;
      g.fillStyle(0x6a5c95, 1);
      g.fillRect(x, 240 - h, w, h);
      x += w;
    }
    // Water tower and church steeple
    wrap((dx) => {
      g.fillStyle(0x4d4378, 1);
      g.fillRect(dx + 712, 70, 4, 60);
      g.fillRect(dx + 748, 70, 4, 60);
      g.fillEllipse(dx + 732, 62, 64, 34);
      g.fillRect(dx + 702, 54, 60, 12);
      g.fillTriangle(dx + 700, 54, dx + 732, 34, dx + 764, 54);
      g.fillRect(dx + 214, 80, 34, 160);
      g.fillTriangle(dx + 210, 82, dx + 231, 10, dx + 252, 82);
    });
    // Near row: storefronts with lit windows
    x = 0;
    const fronts = [0x4a3f6b, 0x56406a, 0x433a63, 0x5a4570];
    let i = 0;
    while (x < W) {
      const w = 70 + rand() * 60;
      const h = 90 + rand() * 60;
      const c = fronts[i++ % fronts.length];
      g.fillStyle(c, 1);
      g.fillRect(x, 240 - h, w - 4, h);
      // cornice
      g.fillStyle(0x3a3156, 1);
      g.fillRect(x - 2, 240 - h - 6, w, 8);
      // windows
      for (let wy = 240 - h + 14; wy < 200; wy += 26) {
        for (let wx = x + 10; wx < x + w - 20; wx += 22) {
          g.fillStyle(rand() > 0.35 ? 0xffd27a : 0x2e2848, 1);
          g.fillRect(wx, wy, 12, 16);
        }
      }
      // shop window glow at street level
      g.fillStyle(0xffc46b, 0.9);
      g.fillRect(x + 8, 206, w - 22, 26);
      x += w;
    }
  });
  make(scene, 'lamps', W, 190, (g) => {
    const lamp = (x: number) =>
      wrap((dx) => {
        g.fillStyle(0xffe6a8, 0.18);
        g.fillCircle(x + dx, 40, 34);
        g.fillStyle(0xffe6a8, 0.25);
        g.fillCircle(x + dx, 40, 20);
        g.fillStyle(0x2b2b3a, 1);
        g.fillRect(x + dx - 3, 40, 6, 150);
        g.fillRect(x + dx - 8, 184, 16, 6);
        g.fillStyle(0xfff3c8, 1);
        g.fillRoundedRect(x + dx - 9, 28, 18, 18, 4);
        g.fillStyle(0x2b2b3a, 1);
        g.fillTriangle(x + dx - 12, 30, x + dx, 18, x + dx + 12, 30);
      });
    lamp(100);
    lamp(420);
    lamp(740);
    // A bench and a little tree in a planter
    wrap((dx) => {
      g.fillStyle(0x6b4a2f, 1);
      g.fillRect(dx + 240, 160, 70, 6);
      g.fillRect(dx + 240, 148, 70, 5);
      g.fillStyle(0x2b2b3a, 1);
      g.fillRect(dx + 246, 166, 4, 24);
      g.fillRect(dx + 300, 166, 4, 24);
      g.fillStyle(0x8a6d5a, 1);
      g.fillRect(dx + 580, 166, 34, 24);
      g.fillStyle(0x4f8a4a, 1);
      g.fillCircle(dx + 597, 140, 26);
      g.fillCircle(dx + 585, 152, 16);
      g.fillCircle(dx + 610, 152, 16);
    });
  });
  make(scene, 'trashcan', 34, 46, (g) => {
    g.fillStyle(0x7d8a8f, 1);
    g.fillRect(4, 10, 26, 36);
    g.fillStyle(0x93a1a6, 1);
    for (const x of [8, 15, 22]) g.fillRect(x, 13, 3, 30);
    g.fillStyle(0x5f6b70, 1);
    g.fillRoundedRect(1, 4, 32, 8, 3);
    g.fillRect(13, 0, 8, 5);
    g.lineStyle(1.5, 0x4a5458, 1);
    g.strokeRect(4, 10, 26, 36);
  });
  make(scene, 'hydrant', 28, 38, (g) => {
    g.fillStyle(0xc9372c, 1);
    g.fillRoundedRect(7, 8, 14, 28, 3);
    g.fillEllipse(14, 9, 16, 10);
    g.fillRect(2, 16, 24, 7);
    g.fillRect(4, 34, 20, 4);
    g.fillStyle(0x9c2a21, 1);
    g.fillCircle(14, 4, 3);
    g.fillRect(9, 26, 10, 2);
    g.fillStyle(0xf0e0d0, 0.6);
    g.fillRect(9, 10, 2, 22);
  });
  make(scene, 'sign', 36, 44, (g) => {
    g.fillStyle(0x6b4a2f, 1);
    g.fillTriangle(2, 44, 18, 0, 34, 44);
    g.fillStyle(0x2e3a33, 1);
    g.fillTriangle(6, 40, 18, 6, 30, 40);
    g.fillStyle(0xf4efe0, 1);
    g.fillRect(12, 22, 12, 2);
    g.fillRect(11, 28, 14, 2);
    g.fillRect(13, 34, 10, 2);
  });
  make(scene, 'awning', 124, 42, (g) => {
    const stripes = [0x3f7d3a, 0xf4efe0];
    for (let i = 0; i < 8; i++) {
      g.fillStyle(stripes[i % 2], 1);
      g.fillRect(2 + i * 15, 4, 15, 26);
    }
    // scalloped edge
    for (let i = 0; i < 8; i++) {
      g.fillStyle(stripes[i % 2], 1);
      g.fillCircle(9.5 + i * 15, 30, 7.5);
    }
    g.fillStyle(0x2b2b3a, 1);
    g.fillRect(0, 0, 124, 5);
  });
  make(scene, 'streetcat', 44, 32, (g) => {
    // grey cat running left, tail up
    g.fillStyle(0x6f6a72, 1);
    g.fillEllipse(24, 20, 26, 13);
    g.fillCircle(10, 14, 8);
    g.fillTriangle(4, 10, 6, 1, 11, 7);
    g.fillTriangle(11, 7, 15, 0, 17, 9);
    g.lineStyle(4, 0x6f6a72, 1);
    g.lineBetween(36, 18, 42, 6);
    g.lineBetween(14, 25, 8, 31);
    g.lineBetween(20, 25, 22, 31);
    g.lineBetween(30, 25, 26, 31);
    g.lineBetween(34, 24, 38, 31);
    g.fillStyle(0xe8d36a, 1);
    g.fillCircle(7, 13, 1.8);
  });
  make(scene, 'streetdog', 48, 38, (g) => {
    // a scruffy dog charging left
    g.fillStyle(0x8a6a4a, 1);
    g.fillEllipse(28, 22, 30, 16);
    g.fillCircle(11, 15, 10);
    g.fillEllipse(4, 18, 10, 8);
    g.fillStyle(0x5e4630, 1);
    g.fillEllipse(15, 10, 7, 13);
    g.lineStyle(5, 0x8a6a4a, 1);
    g.lineBetween(16, 28, 10, 37);
    g.lineBetween(22, 28, 24, 37);
    g.lineBetween(34, 28, 30, 37);
    g.lineBetween(40, 26, 44, 37);
    g.lineBetween(42, 18, 47, 8);
    g.fillStyle(0x1a1a1a, 1);
    g.fillCircle(1, 17, 2.5);
    g.fillCircle(9, 12, 1.6);
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(3, 21, 6, 21, 4.5, 24); // tooth
  });
  const pigeon = (key: string, up: boolean) =>
    make(scene, key, 40, 24, (g) => {
      g.fillStyle(0x8a8f9e, 1);
      g.fillEllipse(20, 14, 24, 11);
      g.fillCircle(8, 11, 5.5);
      g.fillStyle(0x5aa08a, 1);
      g.fillEllipse(12, 15, 7, 4);
      g.fillStyle(0x6b7080, 1);
      if (up) g.fillTriangle(14, 12, 28, 12, 22, 0);
      else g.fillTriangle(14, 13, 28, 13, 22, 24);
      g.fillStyle(0xe0a040, 1);
      g.fillTriangle(3, 11, 0, 12, 3, 13);
      g.fillStyle(0x111111, 1);
      g.fillCircle(7, 10, 1.1);
    });
  pigeon('pigeon-0', true);
  pigeon('pigeon-1', false);
  const person = (key: string, armUp: boolean) =>
    make(scene, key, 34, 64, (g) => {
      // a neighbor walking by, waving hello
      g.fillStyle(0x3a4a6b, 1);
      g.fillRect(11, 38, 5, 24);
      g.fillRect(18, 38, 5, 24);
      g.fillStyle(0xc0552f, 1);
      g.fillRoundedRect(8, 18, 18, 24, 4);
      g.fillStyle(0xe8b48a, 1);
      g.fillCircle(17, 11, 7);
      g.fillStyle(0x4a3326, 1);
      g.fillEllipse(17, 6, 15, 7);
      g.lineStyle(4, 0xc0552f, 1);
      g.lineBetween(10, 22, 6, 36);
      if (armUp) g.lineBetween(24, 22, 31, 8);
      else g.lineBetween(24, 22, 33, 14);
      g.fillStyle(0xe8b48a, 1);
      g.fillCircle(armUp ? 31 : 33, armUp ? 7 : 13, 2.6);
    });
  person('person-0', true);
  person('person-1', false);

  // ---------- Level 5: Rainy Riverside ----------
  make(scene, 'river', W, 80, (g) => {
    const bands = [0x7f9aa3, 0x6f8e98, 0x62848f, 0x577b87];
    bands.forEach((c, i) => {
      g.fillStyle(c, 1);
      g.fillRect(0, 10 + i * 13, W, 14);
    });
    g.fillStyle(0xc9d8dd, 0.7);
    for (let i = 0; i < 22; i++) g.fillRect((i * 173) % W, 16 + ((i * 29) % 44), 26 + (i % 3) * 14, 2);
    // reeds along the near bank
    g.fillStyle(0x4c7a44, 1);
    for (let x = 4; x < W; x += 9) {
      const h = 10 + ((x * 7) % 16);
      g.fillTriangle(x, 80, x + 2, 80 - h, x + 4, 80);
    }
  });
  make(scene, 'willows', W, 190, (g) => {
    const willow = (x: number, h: number) =>
      wrap((dx) => {
        const bx = x + dx;
        g.fillStyle(0x5b4636, 1);
        g.fillRect(bx - 6, 190 - h, 12, h);
        g.fillStyle(0x5f8a52, 1);
        g.fillEllipse(bx, 190 - h, 120, 70);
        g.fillStyle(0x6f9a5f, 1);
        // drooping strands
        for (let s = -54; s <= 54; s += 8) {
          const len = 50 + ((s * s) % 30);
          g.fillRect(bx + s, 190 - h, 4, len);
        }
      });
    willow(150, 120);
    willow(560, 140);
    willow(860, 110);
    g.fillStyle(0x547f4a, 1);
    for (const [x, r] of [[330, 26], [420, 20], [700, 24]] as const) wrap((dx) => g.fillCircle(x + dx, 190, r));
  });
  make(scene, 'stump', 42, 36, (g) => {
    g.fillStyle(0x7a5232, 1);
    g.fillRect(4, 10, 34, 26);
    g.fillTriangle(0, 36, 6, 24, 8, 36);
    g.fillTriangle(42, 36, 36, 24, 34, 36);
    g.fillStyle(0xc89a62, 1);
    g.fillEllipse(21, 10, 34, 12);
    g.lineStyle(1.5, 0x9c6b3c, 1);
    g.strokeEllipse(21, 10, 22, 7);
    g.strokeEllipse(21, 10, 10, 3);
    g.fillStyle(0x5f9c3a, 1);
    g.fillEllipse(10, 30, 10, 6);
  });
  make(scene, 'creek', 150, 16, (g) => {
    g.fillStyle(0x5b84a8, 1);
    g.fillEllipse(75, 8, 150, 16);
    g.fillStyle(0x7fa8c9, 1);
    g.fillEllipse(60, 6, 80, 6);
    g.fillStyle(0xdbeaf5, 0.9);
    g.fillRect(30, 6, 18, 2);
    g.fillRect(86, 9, 24, 2);
    g.fillStyle(0x8a8f97, 1);
    g.fillEllipse(8, 11, 14, 8);
    g.fillEllipse(142, 10, 14, 9);
  });
  make(scene, 'frog', 34, 26, (g) => {
    g.fillStyle(0x5aa14a, 1);
    g.fillEllipse(17, 17, 26, 14);
    g.fillCircle(9, 8, 6);
    g.fillCircle(21, 8, 6);
    g.fillStyle(0x3f7a33, 1);
    g.fillEllipse(6, 23, 12, 5);
    g.fillEllipse(28, 23, 12, 5);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(9, 7, 3);
    g.fillCircle(21, 7, 3);
    g.fillStyle(0x111111, 1);
    g.fillCircle(8.5, 7, 1.6);
    g.fillCircle(20.5, 7, 1.6);
  });
  const duck = (key: string, up: boolean) =>
    make(scene, key, 44, 26, (g) => {
      g.fillStyle(0x8a6a4a, 1);
      g.fillEllipse(24, 15, 28, 12);
      g.fillStyle(0x2f7a4a, 1);
      g.fillCircle(9, 11, 6);
      g.fillStyle(0xffffff, 1);
      g.fillRect(13, 13, 3, 6);
      g.fillStyle(0x6b5038, 1);
      if (up) g.fillTriangle(18, 13, 34, 13, 28, 0);
      else g.fillTriangle(18, 14, 34, 14, 26, 26);
      g.fillStyle(0xe8b030, 1);
      g.fillEllipse(3, 12, 8, 4);
    });
  duck('duck-0', true);
  duck('duck-1', false);
  make(scene, 'raindrop', 3, 14, (g) => {
    g.fillStyle(0xd6e4f0, 1);
    g.fillRect(0, 0, 2, 14);
  });

  // ---------- Level 6: Snowy Night ----------
  make(scene, 'snowpines', W, 190, (g) => {
    const pine = (x: number, h: number) =>
      wrap((dx) => {
        const bx = x + dx;
        g.fillStyle(0x3a2a22, 1);
        g.fillRect(bx - 4, 172, 8, 18);
        for (let i = 0; i < 3; i++) {
          const top = 190 - h + i * (h * 0.24);
          const half = 15 + i * 10;
          g.fillStyle(0x1f4a3a, 1);
          g.fillTriangle(bx - half, top + h * 0.38, bx, top, bx + half, top + h * 0.38);
          g.fillStyle(0xeef3fa, 1);
          g.fillTriangle(bx - half * 0.45, top + h * 0.17, bx, top, bx + half * 0.45, top + h * 0.17);
          g.fillRect(bx - half, top + h * 0.36, half * 2, 3);
        }
      });
    for (const [x, h] of [[40, 130], [90, 100], [300, 150], [350, 110], [620, 120], [880, 140]] as const) pine(x, h);
    // a log cabin with a warm window
    wrap((dx) => {
      const cx = dx + 480;
      g.fillStyle(0x6b4a30, 1);
      g.fillRect(cx, 128, 90, 62);
      g.fillStyle(0x553a24, 1);
      for (let y = 134; y < 190; y += 9) g.fillRect(cx, y, 90, 2);
      g.fillStyle(0xeef3fa, 1);
      g.fillTriangle(cx - 10, 130, cx + 45, 92, cx + 100, 130);
      g.fillStyle(0xffc46b, 1);
      g.fillRect(cx + 16, 148, 20, 18);
      g.fillStyle(0xffc46b, 0.25);
      g.fillCircle(cx + 26, 157, 22);
      g.fillStyle(0x3a2a22, 1);
      g.fillRect(cx + 56, 150, 18, 40);
      g.fillStyle(0x5b5b66, 1);
      g.fillRect(cx + 64, 96, 10, 24);
    });
    g.fillStyle(0xeef3fa, 1);
    for (const [x, r] of [[200, 26], [760, 30]] as const) wrap((dx) => g.fillEllipse(x + dx, 190, r * 3, r));
  });
  make(scene, 'snowman', 42, 58, (g) => {
    g.fillStyle(0xf4f7fb, 1);
    g.fillCircle(21, 44, 14);
    g.fillCircle(21, 24, 10);
    g.fillCircle(21, 9, 7);
    g.lineStyle(1.5, 0xc6d0de, 1);
    g.strokeCircle(21, 44, 14);
    g.strokeCircle(21, 24, 10);
    g.fillStyle(0xd6402b, 1);
    g.fillRect(12, 15, 18, 4);
    g.fillRect(24, 15, 4, 10);
    g.fillStyle(0x16202a, 1);
    g.fillCircle(18, 8, 1.4);
    g.fillCircle(24, 8, 1.4);
    g.fillCircle(21, 24, 1.6);
    g.fillCircle(21, 31, 1.6);
    g.fillStyle(0xf28c3a, 1);
    g.fillTriangle(21, 10, 21, 12, 13, 11);
    g.lineStyle(2, 0x6b4a30, 1);
    g.lineBetween(11, 22, 1, 14);
    g.lineBetween(31, 22, 41, 15);
  });
  make(scene, 'sled', 62, 26, (g) => {
    g.fillStyle(0xb5462e, 1);
    g.fillRoundedRect(6, 4, 50, 10, 3);
    g.lineStyle(3, 0x55575d, 1);
    g.lineBetween(10, 14, 10, 22);
    g.lineBetween(50, 14, 50, 22);
    g.beginPath();
    g.moveTo(2, 22);
    g.lineTo(52, 22);
    g.lineTo(58, 16);
    g.strokePath();
    g.fillStyle(0xeef3fa, 1);
    g.fillEllipse(30, 4, 40, 6);
  });
  make(scene, 'snowbranch', 110, 50, (g) => {
    g.lineStyle(8, 0x5b3b22, 1);
    g.lineBetween(110, 10, 6, 16);
    g.lineStyle(4, 0x5b3b22, 1);
    g.lineBetween(70, 12, 52, 30);
    g.lineBetween(36, 14, 20, 30);
    const tufts: [number, number, number][] = [
      [10, 24, 12], [28, 34, 13], [48, 36, 12], [64, 30, 12], [84, 24, 11], [40, 26, 10], [94, 16, 9],
    ];
    for (const [x, y, r] of tufts) {
      g.fillStyle(0x24503f, 1);
      g.fillCircle(x, y, r);
      g.fillStyle(0xeef3fa, 1);
      g.fillEllipse(x, y - r * 0.5, r * 1.7, r * 0.8);
    }
  });
  make(scene, 'snowcanopy', 180, 110, (g) => {
    const puffs: [number, number, number][] = [[30, 60, 34], [90, 70, 40], [150, 58, 32], [60, 36, 30], [120, 34, 32], [90, 30, 26]];
    for (const [x, y, r] of puffs) {
      g.fillStyle(0x24503f, 1);
      g.fillCircle(x, y, r);
    }
    g.fillStyle(0xeef3fa, 1);
    for (const [x, y, r] of puffs) g.fillEllipse(x, y - r * 0.55, r * 1.6, r * 0.7);
  });
  make(scene, 'fox', 50, 34, (g) => {
    g.fillStyle(0xd9692a, 1);
    g.fillEllipse(26, 20, 28, 14);
    g.fillCircle(11, 15, 8);
    g.fillTriangle(1, 18, 9, 12, 9, 20);
    g.fillTriangle(6, 9, 9, 0, 13, 8);
    g.fillTriangle(12, 8, 17, 0, 18, 10);
    g.fillStyle(0xd9692a, 1);
    g.fillEllipse(44, 14, 16, 9);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(50, 12, 6, 6);
    g.fillEllipse(8, 20, 8, 5);
    g.lineStyle(3, 0x2b1a0d, 1);
    g.lineBetween(16, 26, 12, 33);
    g.lineBetween(22, 26, 24, 33);
    g.lineBetween(32, 26, 28, 33);
    g.lineBetween(36, 25, 40, 33);
    g.fillStyle(0x111111, 1);
    g.fillCircle(1.5, 18, 1.8);
    g.fillCircle(10, 13, 1.4);
  });
  const cardinal = (key: string, up: boolean) =>
    make(scene, key, 40, 24, (g) => {
      g.fillStyle(0xc9302c, 1);
      g.fillEllipse(20, 14, 22, 10);
      g.fillCircle(9, 11, 6);
      g.fillTriangle(6, 7, 10, -1, 13, 8);
      g.fillStyle(0x9c2421, 1);
      if (up) g.fillTriangle(14, 12, 26, 12, 20, 0);
      else g.fillTriangle(14, 13, 26, 13, 21, 24);
      g.fillStyle(0x1a1a1a, 1);
      g.fillCircle(6, 12, 2.4);
      g.fillStyle(0xf2a33a, 1);
      g.fillTriangle(3, 11, 0, 12.5, 3, 14);
    });
  cardinal('cardinal-0', true);
  cardinal('cardinal-1', false);
  const owl = (key: string, up: boolean) =>
    make(scene, key, 50, 34, (g) => {
      g.fillStyle(0x8a7560, 1);
      g.fillEllipse(25, 20, 22, 22);
      g.fillStyle(0x6b5845, 1);
      if (up) {
        g.fillTriangle(14, 18, 0, 4, 18, 12);
        g.fillTriangle(36, 18, 50, 4, 32, 12);
      } else {
        g.fillTriangle(14, 18, 0, 30, 18, 24);
        g.fillTriangle(36, 18, 50, 30, 32, 24);
      }
      g.fillStyle(0xf4e3c1, 1);
      g.fillCircle(20, 15, 5);
      g.fillCircle(30, 15, 5);
      g.fillStyle(0xe8b030, 1);
      g.fillCircle(20, 15, 3);
      g.fillCircle(30, 15, 3);
      g.fillStyle(0x111111, 1);
      g.fillCircle(20, 15, 1.4);
      g.fillCircle(30, 15, 1.4);
      g.fillStyle(0xd9a441, 1);
      g.fillTriangle(23, 19, 27, 19, 25, 23);
    });
  owl('owl-0', true);
  owl('owl-1', false);
  make(scene, 'snowflake', 8, 8, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 3);
  });
}
