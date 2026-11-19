import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { GAME_HEIGHT, GAME_WIDTH } from './config';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#bfe6ff',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 2000 }, debug: false },
  },
  scene: [GameScene],
});

// Handy for debugging and automated checks during development only.
if (import.meta.env.DEV) {
  (window as unknown as { __game: Phaser.Game }).__game = game;
}
