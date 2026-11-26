import Phaser from 'phaser';
import type { PetChoice } from './pets';

/**
 * The Goodwookie sloth riding on the pet's head (the "Bring the sloth along"
 * box on the setup card). It is its own picture, laid over whichever pet
 * picture is showing: the spot it sits on is found from that picture's
 * outline (the top of the head), so one sloth fits every breed and the cat
 * in every pose. See docs/sloth-rider.md for the pictures Elon paints.
 *
 * Until his pictures arrive, side.webp is a stand-in cut from Chewy's card.
 */
export const SLOTH = {
  /** the sloth hugging a head, seen from the side (facing right, like the pets) */
  side: 'sloth-side',
  /** the sloth seen from behind, for the runs into the screen (falls back to `side`) */
  back: 'sloth-back',
  /** where in the sloth picture the top of the pet's head goes (share of width, height) */
  seat: { side: { x: 0.6, y: 0.6 }, back: { x: 0.5, y: 0.72 } },
  /** the sloth's height as a share of the pet's height (the standing pet) */
  size: { dog: 0.36, cat: 0.42 },
  /** how far down into the head's outline it sits (share of the pet's height): ears are thin */
  sink: 0.07,
};

/** Chewy is painted with the sloth already on, so he gets no second one. */
export function paintedWithSloth(c: PetChoice): boolean {
  return c.species === 'dog' && !c.dog && (c.look ?? 'chewy') === 'chewy';
}

/** The sloth pictures painted so far (add 'back' when it arrives). */
const PAINTED = [SLOTH.side];

export function queueSloth(scene: Phaser.Scene): boolean {
  let queued = false;
  for (const key of PAINTED) {
    if (scene.textures.exists(key)) continue;
    scene.load.image(key, `art/sloth/${key.slice('sloth-'.length)}.webp`);
    queued = true;
  }
  return queued;
}

interface Outline {
  /** the top of the head, in the frame's own pixels from its top-left */
  x: number;
  y: number;
  /** the pet's height in this frame (opaque rows) */
  h: number;
}

const outlines = new Map<string, Outline | null>();
let canvas: HTMLCanvasElement | undefined;

/**
 * The top of the pet's head in one frame of a picture. Side-on pets face
 * right, so the head is the highest point of the front 40% of the body (the
 * tail can be held high at the back); from behind it is the highest point of
 * the middle half. Read once per frame and kept.
 */
export function headTop(scene: Phaser.Scene, key: string, frame: string | number, back: boolean): Outline | undefined {
  const id = `${key}|${frame}|${back ? 'b' : 's'}`;
  const known = outlines.get(id);
  if (known !== undefined) return known ?? undefined;
  let out: Outline | null = null;
  try {
    const f = scene.textures.getFrame(key, frame);
    if (f) {
      const src = f.source.image as CanvasImageSource;
      const w = f.cutWidth;
      const h = f.cutHeight;
      canvas ??= document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(src, f.cutX, f.cutY, w, h, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;
      const tops: number[] = new Array(w).fill(-1);
      let x0 = w;
      let x1 = -1;
      let y1 = -1;
      for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
          if (px[(y * w + x) * 4 + 3] > 128) {
            if (tops[x] < 0) tops[x] = y;
            y1 = Math.max(y1, y);
          }
        }
        if (tops[x] >= 0) {
          x0 = Math.min(x0, x);
          x1 = x;
        }
      }
      if (x1 >= 0) {
        const bw = x1 - x0 + 1;
        const from = back ? x0 + bw * 0.25 : x1 - bw * 0.4;
        const to = back ? x0 + bw * 0.75 : x1;
        let top = h;
        for (let x = Math.ceil(from); x <= to; x++) if (tops[x] >= 0) top = Math.min(top, tops[x]);
        const xs: number[] = [];
        for (let x = Math.ceil(from); x <= to; x++) if (tops[x] >= 0 && tops[x] <= top + 4) xs.push(x);
        const minTop = Math.min(...tops.filter((t) => t >= 0));
        out = { x: xs.reduce((a, b) => a + b, 0) / xs.length, y: top, h: y1 - minTop + 1 };
      }
    }
  } catch {
    out = null; // a picture we can't read: no sloth on it
  }
  outlines.set(id, out);
  return out ?? undefined;
}
