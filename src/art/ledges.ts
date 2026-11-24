import Phaser from 'phaser';
import { blade, blob, css, fillOut, lin, paint, seeded, shade, type Ctx } from './paint';

/**
 * Ledges for the climbing sections: stone shelves the pet can jump up onto
 * and run along, each held up by a rock pillar behind the trail. Painted in
 * code for now; a painted file with the same key (see artFiles.ts) would
 * replace them.
 */
export type LedgeStyle = 'rock' | 'sandstone';

export const LEDGE_H = 30; // how thick a ledge is, in game px (its top is the part you stand on)

const LOOK: Record<LedgeStyle, { stone: number; top: number; topDark: number; seam: number }> = {
  rock: { stone: 0x8d8a82, top: 0x7fae46, topDark: 0x4f7a2a, seam: 0x5e5a52 },
  sandstone: { stone: 0xc9764a, top: 0xe3a46a, topDark: 0xb8693c, seam: 0x8e4a2a },
};

/** A shelf of stone `w` game px wide. Widths are rounded so a few textures cover every ledge. */
export function ledgeTexture(scene: Phaser.Scene, style: LedgeStyle, w: number): string {
  const width = Math.max(80, Math.round(w / 20) * 20);
  const key = `ledge-${style}-${width}`;
  const L = LOOK[style];
  paint(scene, key, width, LEDGE_H + 8, (c) => {
    const rnd = seeded(width + (style === 'rock' ? 11 : 37));
    // the slab: a flat top, a rough underside that thins toward the ends
    const pts: [number, number][] = [[2, 6], [width - 2, 6], [width - 1, 14]];
    for (let x = width - 10; x > 10; x -= 22) pts.push([x, LEDGE_H - 2 + rnd() * 8 - (x < 40 || x > width - 40 ? 6 : 0)]);
    pts.push([1, 14]);
    blob(c, pts);
    fillOut(c, lin(c, 0, 4, 0, LEDGE_H + 6, [[0, shade(L.stone, 0.15)], [0.5, L.stone], [1, shade(L.stone, -0.35)]]), shade(L.stone, -0.6), 1.6);
    // seams in the rock
    c.save();
    c.clip();
    for (let i = 0; i < width / 28; i++) {
      const x = 8 + rnd() * (width - 16);
      c.beginPath();
      c.moveTo(x, 10 + rnd() * 4);
      c.lineTo(x + rnd() * 8 - 4, LEDGE_H - 4);
      c.strokeStyle = css(L.seam, 0.45);
      c.lineWidth = 1.2;
      c.stroke();
    }
    if (style === 'sandstone') {
      // the canyon's layered bands
      for (const y of [13, 20]) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(width, y + 1);
        c.strokeStyle = css(shade(L.stone, -0.2), 0.5);
        c.lineWidth = 2;
        c.stroke();
      }
    }
    c.restore();
    // the top you stand on: grass on the hilltop, a sunlit lip in the canyon
    c.beginPath();
    c.roundRect(0, 3, width, 7, 3);
    fillOut(c, lin(c, 0, 3, 0, 10, [[0, shade(L.top, 0.2)], [1, L.topDark]]), shade(L.topDark, -0.4), 1.2);
    if (style === 'rock') {
      for (let x = 4; x < width - 4; x += 5 + rnd() * 4) blade(c, x, 6, 4 + rnd() * 5, rnd() * 4 - 2, rnd() < 0.5 ? L.top : L.topDark, 1.4);
    }
  });
  return key;
}

/** A rock pillar that holds a ledge up, drawn behind the trail. */
export function pillarTexture(scene: Phaser.Scene, style: LedgeStyle): string {
  const key = `ledge-pillar-${style}`;
  const L = LOOK[style];
  const w = 44;
  const h = 260;
  paint(scene, key, w, h, (c: Ctx) => {
    blob(c, [[12, 0], [32, 0], [36, h * 0.4], [40, h - 4], [w / 2, h], [4, h - 4], [8, h * 0.4]]);
    fillOut(c, lin(c, 0, 0, w, 0, [[0, shade(L.stone, 0.05)], [0.4, shade(L.stone, -0.1)], [1, shade(L.stone, -0.45)]]), shade(L.stone, -0.6), 1.4);
  });
  return key;
}
