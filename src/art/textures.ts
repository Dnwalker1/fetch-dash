import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

/**
 * Level 1's critters and the shared clouds, drawn as flat shapes. The trail's
 * props are painted in props.ts and its ground in ground.ts.
 */

const C = {
  squirrel: 0x9a7356,
  squirrelDark: 0x6b4d38,
  bird: 0x3b3b5c,
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

  // ---- Pickups ----


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
}
