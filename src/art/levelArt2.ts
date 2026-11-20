import Phaser from 'phaser';

/**
 * Weather bits for Level 5 (rain) and Level 6 (snow). The backgrounds of
 * levels 4 to 6 are painted (public/art), their obstacles are in props.ts
 * and their critters in critters.ts.
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
  // ---------- Level 5: Rainy Riverside ----------
  make(scene, 'raindrop', 3, 14, (g) => {
    g.fillStyle(0xd6e4f0, 1);
    g.fillRect(0, 0, 2, 14);
  });

  // ---------- Level 6: Snowy Night ----------
  make(scene, 'snowflake', 8, 8, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 3);
  });
}
