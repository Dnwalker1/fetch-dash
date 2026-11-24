import Phaser from 'phaser';
import { GAME_HEIGHT, GROUND_Y } from '../config';
import { blob, circle, css, ellipse, fillOut, lin, line, paint, rad, seeded, shade } from './paint';

/**
 * The dig-and-tunnel sections: a dig spot on the trail, and the tunnel under
 * it (a scrolling strip of earth with a low ceiling, roots and stones).
 * Painted in code for now; painted files with these keys would replace them.
 */
export const TUNNEL_TILE_W = 512;
/** The tunnel's ceiling: the pet bumps its head here instead of jumping higher. */
export const TUNNEL_CEILING = 300;

const EARTH = 0x5a3a22;

/** The tunnel strip, as tall as the screen; it repeats sideways every TUNNEL_TILE_W. */
export function paintTunnel(scene: Phaser.Scene): string {
  const key = 'tunnel-strip';
  paint(scene, key, TUNNEL_TILE_W, GAME_HEIGHT, (c) => {
    const W = TUNNEL_TILE_W;
    const rnd = seeded(91);
    // solid earth above the ceiling and below the floor, the dug-out tunnel between
    c.fillStyle = lin(c, 0, 0, 0, GAME_HEIGHT, [[0, shade(EARTH, -0.45)], [0.5, shade(EARTH, -0.2)], [1, shade(EARTH, -0.5)]]);
    c.fillRect(0, 0, W, GAME_HEIGHT);
    // the hollow: lighter, with soft edges
    c.fillStyle = lin(c, 0, TUNNEL_CEILING - 20, 0, GROUND_Y + 6, [[0, EARTH, 0], [0.15, shade(EARTH, 0.08)], [0.85, shade(EARTH, 0.18)], [1, shade(EARTH, 0.05)]]);
    c.fillRect(0, TUNNEL_CEILING - 20, W, GROUND_Y - TUNNEL_CEILING + 26);
    // stones and pebbles, drawn wrapped so the strip tiles
    const wrap = (x: number, draw: (x: number) => void) => [x - W, x, x + W].forEach(draw);
    for (let i = 0; i < 34; i++) {
      const x = rnd() * W;
      const inRock = rnd() < 0.6;
      const y = inRock ? (rnd() < 0.5 ? 40 + rnd() * (TUNNEL_CEILING - 80) : GROUND_Y + 14 + rnd() * 80) : TUNNEL_CEILING + 10 + rnd() * (GROUND_Y - TUNNEL_CEILING - 40);
      const r = inRock ? 4 + rnd() * 12 : 2 + rnd() * 4;
      const tone = shade(0x8a7a68, (rnd() - 0.5) * 0.4);
      wrap(x, (xx) => {
        ellipse(c, xx, y, r * 1.3, r);
        fillOut(c, rad(c, xx - r * 0.4, y - r * 0.4, 0, xx, y, r * 1.3, [[0, shade(tone, 0.25)], [1, shade(tone, inRock ? -0.35 : -0.15)]]), shade(tone, -0.6), 1, inRock ? 0.6 : 0.3);
      });
    }
    // the ceiling's edge, and roots poking through it
    c.beginPath();
    c.moveTo(0, TUNNEL_CEILING);
    for (let x = 0; x <= W; x += 16) c.lineTo(x, TUNNEL_CEILING - 4 + Math.sin((x / W) * Math.PI * 6) * 4);
    c.strokeStyle = css(shade(EARTH, -0.55), 0.8);
    c.lineWidth = 3;
    c.stroke();
    for (let i = 0; i < 9; i++) {
      const x = rnd() * W;
      const len = 14 + rnd() * 26;
      wrap(x, (xx) => line(c, [[xx, TUNNEL_CEILING - 6], [xx + 3, TUNNEL_CEILING + len * 0.5], [xx - 2, TUNNEL_CEILING + len]], 0xc8a878, 2, 0.75));
    }
    // the floor: packed dirt with a worn path
    c.fillStyle = lin(c, 0, GROUND_Y, 0, GROUND_Y + 30, [[0, shade(EARTH, 0.25)], [1, shade(EARTH, -0.3)]]);
    c.fillRect(0, GROUND_Y, W, 30);
    line(c, [[0, GROUND_Y + 1], [W, GROUND_Y + 1]], shade(EARTH, 0.45), 2, 0.7);
  });
  return key;
}

/** A clump of roots hanging from the tunnel's ceiling: slide under it. */
export function paintRoots(scene: Phaser.Scene): string {
  const key = 'tunnel-roots';
  const w = 90;
  const h = GROUND_Y - 40 - TUNNEL_CEILING + 6; // reaches down to 40 px above the floor
  paint(scene, key, w, h, (c) => {
    const rnd = seeded(5);
    for (let i = 0; i < 11; i++) {
      const x0 = 8 + rnd() * (w - 16);
      const len = h * (0.55 + rnd() * 0.45);
      const sway = (rnd() - 0.5) * 22;
      const tone = shade(0xb08858, (rnd() - 0.5) * 0.3);
      line(c, [[x0, 0], [x0 + sway * 0.4, len * 0.45], [x0 + sway, len * 0.8], [x0 + sway * 0.8, len]], shade(tone, -0.5), 5.5, 0.9);
      line(c, [[x0, 0], [x0 + sway * 0.4, len * 0.45], [x0 + sway, len * 0.8], [x0 + sway * 0.8, len]], tone, 3.5);
    }
    // the clump of earth they hang from
    blob(c, [[0, 0], [w, 0], [w - 8, 14], [w / 2, 20], [8, 14]]);
    fillOut(c, lin(c, 0, 0, 0, 20, [[0, shade(EARTH, -0.2)], [1, shade(EARTH, -0.45)]]), shade(EARTH, -0.6), 1.2);
  });
  return key;
}

/** Loose dirt on the trail with a bone poking out: swipe down here to dig in. */
export function paintDigSpot(scene: Phaser.Scene, dirt: number): string {
  const key = 'dig-spot';
  paint(scene, key, 110, 40, (c) => {
    // the bone, half buried
    c.save();
    c.translate(62, 14);
    c.rotate(-0.5);
    c.fillStyle = css(0xf4ead2);
    c.strokeStyle = css(0x8a7350, 0.9);
    c.lineWidth = 1.4;
    c.beginPath();
    c.roundRect(-12, -3, 24, 6, 3);
    c.fill();
    c.stroke();
    for (const [x, y] of [[-12, -4], [-12, 4], [12, -4], [12, 4]]) {
      circle(c, x, y, 4);
      c.fill();
      c.stroke();
    }
    c.restore();
    // the mound of loose dirt
    blob(c, [[2, 40], [14, 22], [34, 14], [56, 18], [80, 12], [100, 24], [108, 40]]);
    fillOut(c, lin(c, 0, 10, 0, 40, [[0, shade(dirt, 0.15)], [1, shade(dirt, -0.25)]]), shade(dirt, -0.5), 1.4);
    const rnd = seeded(3);
    for (let i = 0; i < 16; i++) {
      circle(c, 10 + rnd() * 90, 24 + rnd() * 14, 1 + rnd() * 2);
      c.fillStyle = css(shade(dirt, -0.35), 0.8);
      c.fill();
    }
  });
  return key;
}
