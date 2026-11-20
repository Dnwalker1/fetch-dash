import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from './config';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  // Drawn at RENDER_SCALE times the world size; GameScene zooms its camera to match
  width: GAME_WIDTH * RENDER_SCALE,
  height: GAME_HEIGHT * RENDER_SCALE,
  backgroundColor: '#bfe6ff',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: { antialias: true, powerPreference: 'high-performance' },
  physics: {
    default: 'arcade',
    // Step physics with each frame's real time (not a fixed 60 Hz), so on
    // 90/120 Hz screens obstacles and jumps move every frame, in step with
    // the scrolling scenery, instead of every other frame.
    arcade: { gravity: { x: 0, y: 2000 }, fixedStep: false, debug: false },
  },
  scene: [GameScene],
});

// Handy for debugging and automated checks during development only.
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
