import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

/**
 * The drifting clouds behind the code-drawn skies. The trail's props are
 * painted in props.ts, its critters in critters.ts and its ground in ground.ts.
 */

type G = Phaser.GameObjects.Graphics;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function makeTextures(scene: Phaser.Scene): void {
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
