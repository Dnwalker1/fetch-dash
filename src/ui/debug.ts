import Phaser from 'phaser';
import { RENDER_SCALE } from '../config';

/** True when the page address has ?debug=1 (for test builds). */
export const DEBUG = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

/**
 * A small readout in the bottom-left corner for test builds: frames per
 * second, where the last touch or mouse press is, and whatever the scene adds
 * (speed and its multiplier in a run). Switch it on with ?debug=1.
 */
export function addDebugOverlay(scene: Phaser.Scene, extra: () => string): void {
  if (!DEBUG) return;
  const text = scene.add
    .text(8, 532, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: { x: 5, y: 3 },
      resolution: RENDER_SCALE,
    })
    .setOrigin(0, 1)
    .setDepth(1000)
    .setScrollFactor(0);
  let last = '';
  const onUpdate = () => {
    const p = scene.input.activePointer;
    const w = scene.cameras.main.getWorldPoint(p.x, p.y);
    const s = `fps ${scene.game.loop.actualFps.toFixed(0)}  input ${p.isDown ? 'down' : 'up'} ${w.x.toFixed(0)},${w.y.toFixed(0)}  ${extra()}`;
    if (s !== last) text.setText((last = s));
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
}
