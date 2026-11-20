import Phaser from 'phaser';

/**
 * Critters and weather bits for Level 4 (Main Street at dusk), Level 5
 * (Rainy Riverside) and Level 6 (Snowy Night). Their backgrounds are painted
 * (public/art) and their obstacles are in props.ts.
 */

type G = Phaser.GameObjects.Graphics;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function makeLevelArt2(scene: Phaser.Scene): void {
  // ---------- Level 4: Main Street at dusk ----------
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
