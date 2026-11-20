import Phaser from 'phaser';
import { RENDER_SCALE } from '../config';
import { propFromFile } from './propArt';

/**
 * A small painting kit for code-drawn art. It draws with the browser's canvas
 * (gradients, soft shading, highlights, warm outlines and a little grain)
 * instead of flat shapes, so the things the pet meets on the trail sit well
 * in front of the painted backgrounds.
 */

export type Ctx = CanvasRenderingContext2D;
type Stop = [offset: number, color: number, alpha?: number];

/**
 * Makes a texture by painting on a canvas. Does nothing if the key exists, or
 * if its picture comes from a painted prop file (see propArt.ts).
 * The drawing code works in game pixels (w x h); the canvas holds `res` times
 * as many, so the art stays sharp once the camera zooms in (RENDER_SCALE).
 * Show it with artScale() so it comes out at w x h in the game.
 */
export function paint(
  scene: Phaser.Scene,
  key: string,
  w: number,
  h: number,
  draw: (c: Ctx) => void,
  res = RENDER_SCALE,
): Phaser.Textures.CanvasTexture | null {
  if (scene.textures.exists(key) || propFromFile(key)) return null;
  const tex = scene.textures.createCanvas(key, Math.round(w * res), Math.round(h * res));
  if (!tex) return null;
  (tex.customData as { res?: number }).res = res;
  const c = tex.getContext();
  c.scale(res, res);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  tex.refresh();
  return tex;
}

/** Canvas pixels per game pixel in a texture (1 for loaded pictures and Graphics-made ones). */
export function resOf(scene: Phaser.Scene, key: string): number {
  return (scene.textures.get(key).customData as { res?: number }).res ?? 1;
}

/** The scale that shows a texture at `scale` times its size in game pixels. */
export function artScale(scene: Phaser.Scene, key: string, scale = 1): number {
  return scale / resOf(scene, key);
}

/**
 * A copy of a loaded picture shrunk once by `f` with the browser's
 * high-quality filter. The strip tiles sideways, so it's shrunk with a bit of
 * its other end on each side and then trimmed, to keep the wrap seamless.
 */
export function resized(scene: Phaser.Scene, key: string, f: number): string {
  const out = `${key}@${f.toFixed(3)}`;
  if (scene.textures.exists(out)) return out;
  const img = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const step = (src: CanvasImageSource, w: number, h: number): HTMLCanvasElement => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d')!;
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, w, h);
    return cv;
  };
  const pad = 16;
  const wrapped = document.createElement('canvas');
  wrapped.width = img.width + pad * 2;
  wrapped.height = img.height;
  const wg = wrapped.getContext('2d')!;
  wg.drawImage(img, pad, 0);
  wg.drawImage(img, pad - img.width, 0);
  wg.drawImage(img, pad + img.width, 0);
  // halve in steps first: one big jump skips pixels even with smoothing on
  let src: HTMLCanvasElement = wrapped;
  let k = 1;
  while (k / 2 >= f) {
    src = step(src, Math.round(src.width / 2), Math.round(src.height / 2));
    k /= 2;
  }
  const tw = Math.round(img.width * f);
  const th = Math.round(img.height * f);
  const last = step(src, Math.round((img.width + pad * 2) * f), th);
  const tex = scene.textures.createCanvas(out, tw, th);
  if (!tex) return key;
  tex.getContext().drawImage(last, -Math.round(pad * f), 0);
  tex.refresh();
  return out;
}

/**
 * A dark outline to set behind a texture (padded so it fits around it), so a
 * thing on the trail stands out from the busy painted scenery behind it.
 */
export function rimOf(scene: Phaser.Scene, key: string, color = 0x1e140c, alpha = 0.8, r = 2): string {
  const rimKey = `${key}-rim`;
  if (scene.textures.exists(rimKey)) return rimKey;
  const res = resOf(scene, key);
  const src = scene.textures.get(key).getSourceImage() as HTMLCanvasElement;
  const pad = Math.ceil(r * res) + 1;
  const w = src.width + pad * 2;
  const h = src.height + pad * 2;
  const tex = scene.textures.createCanvas(rimKey, w, h);
  if (!tex) return key;
  (tex.customData as { res?: number }).res = res;
  const c = tex.getContext();
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    c.drawImage(src, pad + Math.cos(a) * r * res, pad + Math.sin(a) * r * res);
  }
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = css(color, alpha);
  c.fillRect(0, 0, w, h);
  tex.refresh();
  return rimKey;
}

// ---------- Colors ----------

const rgbOf = (hex: number): [number, number, number] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];

/** Lightens (k > 0) toward white or darkens (k < 0) toward black. */
export function shade(hex: number, k: number): number {
  const to = k < 0 ? 0 : 255;
  const a = Math.abs(k);
  const [r, g, b] = rgbOf(hex).map((v) => Math.round(v + (to - v) * a));
  return (r << 16) | (g << 8) | b;
}

export function mix(a: number, b: number, t: number): number {
  const ca = rgbOf(a);
  const cb = rgbOf(b);
  const [r, g, bl] = ca.map((v, i) => Math.round(v + (cb[i] - v) * t));
  return (r << 16) | (g << 8) | bl;
}

export const css = (hex: number, a = 1): string => {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r},${g},${b},${a})`;
};

function stops(g: CanvasGradient, list: Stop[]): CanvasGradient {
  for (const [o, hex, a] of list) g.addColorStop(o, css(hex, a ?? 1));
  return g;
}

export const lin = (c: Ctx, x0: number, y0: number, x1: number, y1: number, list: Stop[]): CanvasGradient =>
  stops(c.createLinearGradient(x0, y0, x1, y1), list);

export const rad = (c: Ctx, x0: number, y0: number, r0: number, x1: number, y1: number, r1: number, list: Stop[]): CanvasGradient =>
  stops(c.createRadialGradient(x0, y0, r0, x1, y1, r1), list);

/** Side lighting across a round thing: lit on the left, shadow on the right. */
export const roundX = (c: Ctx, x0: number, x1: number, base: number, lit = 0.3, dark = -0.4): CanvasGradient =>
  lin(c, x0, 0, x1, 0, [[0, shade(base, lit * 0.3)], [0.28, shade(base, lit)], [0.6, base], [1, shade(base, dark)]]);

/** Top lighting: lit on top, shadow underneath. */
export const roundY = (c: Ctx, y0: number, y1: number, base: number, lit = 0.25, dark = -0.4): CanvasGradient =>
  lin(c, 0, y0, 0, y1, [[0, shade(base, lit)], [0.45, base], [1, shade(base, dark)]]);

// ---------- Shapes ----------

export function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  c.beginPath();
  c.ellipse(x, y, Math.max(rx, 0.1), Math.max(ry, 0.1), rot, 0, Math.PI * 2);
}

export function circle(c: Ctx, x: number, y: number, r: number): void {
  c.beginPath();
  c.arc(x, y, Math.max(r, 0.1), 0, Math.PI * 2);
}

export function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** A closed shape through the points, with rounded corners. */
export function blob(c: Ctx, pts: [number, number][]): void {
  const n = pts.length;
  const mid = (i: number): [number, number] => {
    const a = pts[i % n];
    const b = pts[(i + 1) % n];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  };
  c.beginPath();
  const m0 = mid(0);
  c.moveTo(m0[0], m0[1]);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n];
    const m = mid(i);
    c.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  c.closePath();
}

/** Fills the current path, then gives it a soft outline. */
export function fillOut(c: Ctx, fill: string | CanvasGradient, outline?: number, lw = 1.4, alpha = 0.9): void {
  c.fillStyle = fill;
  c.fill();
  if (outline !== undefined) {
    c.strokeStyle = css(outline, alpha);
    c.lineWidth = lw;
    c.stroke();
  }
}

export function line(c: Ctx, pts: [number, number][], color: number, lw: number, alpha = 1): void {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = css(color, alpha);
  c.lineWidth = lw;
  c.stroke();
}

/** A pointed leaf, petal or needle, from its stem out along the angle. */
export function leaf(c: Ctx, x: number, y: number, len: number, wid: number, ang: number, color: number, vein?: number): void {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(len * 0.45, -wid, len, 0);
  c.quadraticCurveTo(len * 0.45, wid, 0, 0);
  c.fillStyle = css(color);
  c.fill();
  if (vein !== undefined) {
    c.beginPath();
    c.moveTo(len * 0.1, 0);
    c.lineTo(len * 0.8, 0);
    c.strokeStyle = css(vein, 0.5);
    c.lineWidth = 0.7;
    c.stroke();
  }
  c.restore();
}

/** A curved blade of grass (or a reed) from its root up to its tip. */
export function blade(c: Ctx, x: number, y: number, h: number, lean: number, color: number, lw = 1.3, alpha = 1): void {
  c.beginPath();
  c.moveTo(x, y);
  c.quadraticCurveTo(x + lean * 0.2, y - h * 0.6, x + lean, y - h);
  c.strokeStyle = css(color, alpha);
  c.lineWidth = lw;
  c.stroke();
}

// ---------- Randomness and noise ----------

/** Repeatable random numbers, so the art looks the same every time. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth value noise that repeats every `period` cells across, for tiling textures. */
const noiseTables = new Map<number, Float32Array>();

export function noise2(seed: number): (x: number, y: number, period: number) => number {
  const N = 256;
  let tbl = noiseTables.get(seed);
  if (!tbl) {
    // built once per seed: it's 65,536 random numbers
    const r = seeded(seed);
    tbl = new Float32Array(N * N);
    for (let i = 0; i < tbl.length; i++) tbl[i] = r();
    noiseTables.set(seed, tbl);
  }
  const t = tbl;
  return (x, y, period) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = x - xi;
    const v = y - yi;
    const su = u * u * (3 - 2 * u);
    const sv = v * v * (3 - 2 * v);
    const at = (i: number, j: number) => t[(((i % period) + period) % period) + (j & 255) * N];
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv;
  };
}

/**
 * Painterly grain over everything already drawn: big soft blotches (mottle)
 * plus fine speckle (amt). Repeats every `tileW` pixels across so tiling
 * textures stay seamless (use a multiple of 64).
 */
export function grain(c: Ctx, gw: number, gh: number, amt: number, mottle = 0, seed = 7, tileW = 1024): void {
  // w x h are game pixels; the canvas may hold more of them (see paint's res)
  const t = c.getTransform();
  const res = Math.hypot(t.a, t.b) || 1;
  const w = Math.round(gw * res);
  const h = Math.round(gh * res);
  const img = c.getImageData(0, 0, w, h);
  const d = img.data;
  const r = seeded(seed);
  const nz = noise2(seed);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) {
        r();
        continue;
      }
      let k = 1 + (r() - 0.5) * 2 * amt;
      if (mottle) {
        const gx = x / res;
        const gy = y / res;
        const n = 0.5 * nz(gx / 64, gy / 48, tileW / 64) + 0.3 * nz(gx / 32, gy / 24 + 40, tileW / 32) + 0.2 * nz(gx / 16, gy / 12 + 80, tileW / 16);
        k += (n - 0.5) * 2 * mottle;
      }
      d[i] = Math.min(255, d[i] * k);
      d[i + 1] = Math.min(255, d[i + 1] * k);
      d[i + 2] = Math.min(255, d[i + 2] * k);
    }
  }
  c.putImageData(img, 0, 0);
}
