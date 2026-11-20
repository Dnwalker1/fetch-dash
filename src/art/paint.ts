import Phaser from 'phaser';

/**
 * A small painting kit for code-drawn art. It draws with the browser's canvas
 * (gradients, soft shading, highlights, warm outlines and a little grain)
 * instead of flat shapes, so the things the pet meets on the trail sit well
 * in front of the painted backgrounds.
 */

export type Ctx = CanvasRenderingContext2D;
type Stop = [offset: number, color: number, alpha?: number];

/** Makes a texture by painting on a canvas. Does nothing if the key exists. */
export function paint(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void): Phaser.Textures.CanvasTexture | null {
  if (scene.textures.exists(key)) return null;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return null;
  const c = tex.getContext();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  draw(c);
  tex.refresh();
  return tex;
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
export function noise2(seed: number): (x: number, y: number, period: number) => number {
  const r = seeded(seed);
  const N = 256;
  const tbl = new Float32Array(N * N);
  for (let i = 0; i < tbl.length; i++) tbl[i] = r();
  return (x, y, period) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const u = x - xi;
    const v = y - yi;
    const su = u * u * (3 - 2 * u);
    const sv = v * v * (3 - 2 * v);
    const at = (i: number, j: number) => tbl[(((i % period) + period) % period) + (j & 255) * N];
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
export function grain(c: Ctx, w: number, h: number, amt: number, mottle = 0, seed = 7, tileW = 1024): void {
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
        const n = 0.5 * nz(x / 64, y / 48, tileW / 64) + 0.3 * nz(x / 32, y / 24 + 40, tileW / 32) + 0.2 * nz(x / 16, y / 12 + 80, tileW / 16);
        k += (n - 0.5) * 2 * mottle;
      }
      d[i] = Math.min(255, d[i] * k);
      d[i + 1] = Math.min(255, d[i + 1] * k);
      d[i + 2] = Math.min(255, d[i + 2] * k);
    }
  }
  c.putImageData(img, 0, 0);
}
