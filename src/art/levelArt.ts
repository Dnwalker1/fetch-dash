import Phaser from 'phaser';

/**
 * The sun's slow-turning rays, for a sky drawn in code (used only if a
 * level's painted sky can't load).
 */

type G = Phaser.GameObjects.Graphics;

function make(scene: Phaser.Scene, key: string, w: number, h: number, draw: (g: G) => void): void {
  if (scene.textures.exists(key)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  draw(g);
  g.generateTexture(key, w, h);
  g.destroy();
}

export function makeLevelArt(scene: Phaser.Scene): void {
  make(scene, 'rays', 400, 400, (g) => {
    g.fillStyle(0xffffff, 0.16);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const b = a + Math.PI / 32;
      g.fillTriangle(200, 200, 200 + Math.cos(a) * 200, 200 + Math.sin(a) * 200, 200 + Math.cos(b) * 200, 200 + Math.sin(b) * 200);
    }
  });
}
