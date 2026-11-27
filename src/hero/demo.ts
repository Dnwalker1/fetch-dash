
/**
 * The stand-in hero portrait, made on the device from the player's photo.
 * It borrows the layout of Design Your Pet's "Anime Hero" style (sunburst,
 * city at dusk, cape, gold name banner) so the game flow looks right before
 * the live generator is switched on. Once it is, players get the real thing.
 */

const NAVY = '#16202A';
const CREAM = '#EFE3C6';
const GOLD = '#C79A3E';
const RUST = '#A85433';

export async function makeDemoPortrait(img: HTMLImageElement, name: string): Promise<string> {
  const S = 640;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d')!;

  // Frame
  g.fillStyle = NAVY;
  g.fillRect(0, 0, S, S);
  const inset = 18;
  g.save();
  g.beginPath();
  g.rect(inset, inset, S - inset * 2, S - inset * 2);
  g.clip();

  // Sunburst sky
  const sky = g.createRadialGradient(S / 2, 270, 10, S / 2, 270, 460);
  sky.addColorStop(0, '#fff3c4');
  sky.addColorStop(0.18, '#ffc96b');
  sky.addColorStop(0.45, '#c46a8c');
  sky.addColorStop(0.75, '#4b3f8f');
  sky.addColorStop(1, '#1f2350');
  g.fillStyle = sky;
  g.fillRect(0, 0, S, S);
  g.save();
  g.translate(S / 2, 270);
  for (let i = 0; i < 28; i++) {
    g.rotate((Math.PI * 2) / 28);
    g.fillStyle = i % 2 ? 'rgba(255,240,200,0.16)' : 'rgba(255,255,255,0.07)';
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(520, -26);
    g.lineTo(520, 26);
    g.closePath();
    g.fill();
  }
  g.restore();

  // City skyline at dusk
  let x = inset;
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  while (x < S) {
    const w = 26 + rand() * 46;
    const h = 70 + rand() * 150;
    const top = 520 - h;
    g.fillStyle = rand() > 0.5 ? '#2c2a63' : '#363377';
    g.fillRect(x, top, w, h);
    g.fillStyle = 'rgba(255, 214, 120, 0.85)';
    for (let wy = top + 8; wy < 510; wy += 14) {
      for (let wx = x + 5; wx < x + w - 6; wx += 10) if (rand() > 0.55) g.fillRect(wx, wy, 4, 6);
    }
    x += w + 3;
  }
  // Rooftop ledge
  g.fillStyle = '#5b5f73';
  g.fillRect(0, 505, S, 30);
  g.fillStyle = '#80859b';
  g.fillRect(0, 505, S, 6);

  // Cape flaring out to the right, behind the medallion
  const cx = S / 2;
  const cy = 285;
  const r = 165;
  g.fillStyle = RUST;
  g.beginPath();
  g.moveTo(cx - 60, cy - r + 30);
  g.bezierCurveTo(cx + 120, cy - 230, cx + 260, cy - 120, cx + 300, cy - 60);
  g.bezierCurveTo(cx + 230, cy - 50, cx + 260, cy + 10, cx + 210, cy + 60);
  g.bezierCurveTo(cx + 150, cy + 20, cx + 100, cy + 80, cx + 40, cy + 40);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.beginPath();
  g.moveTo(cx + 140, cy - 150);
  g.bezierCurveTo(cx + 210, cy - 120, cx + 250, cy - 80, cx + 280, cy - 62);
  g.bezierCurveTo(cx + 220, cy - 55, cx + 200, cy - 40, cx + 170, cy - 30);
  g.closePath();
  g.fill();

  // The pet, comic-styled, in a gold medallion
  const pet = stylize(img, r * 2);
  g.save();
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.clip();
  g.drawImage(pet, cx - r, cy - r);
  g.restore();
  g.lineWidth = 12;
  g.strokeStyle = GOLD;
  g.beginPath();
  g.arc(cx, cy, r + 4, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 3;
  g.strokeStyle = NAVY;
  g.beginPath();
  g.arc(cx, cy, r + 11, 0, Math.PI * 2);
  g.stroke();
  // Paw emblem at the bottom of the medallion
  pawBadge(g, cx, cy + r + 2, 26);

  // Name banner
  g.fillStyle = CREAM;
  g.beginPath();
  g.moveTo(inset - 4, 540);
  g.lineTo(S - inset + 4, 520);
  g.lineTo(S - inset + 4, 612);
  g.lineTo(inset - 4, 630);
  g.closePath();
  g.fill();
  g.strokeStyle = GOLD;
  g.lineWidth = 4;
  g.stroke();
  const label = (name.trim() || 'Hero').toUpperCase().slice(0, 18);
  let size = 78;
  g.font = `italic 900 ${size}px "Arial Black", Impact, Arial, sans-serif`;
  while (g.measureText(label).width > S - 120 && size > 30) {
    size -= 4;
    g.font = `italic 900 ${size}px "Arial Black", Impact, Arial, sans-serif`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 10;
  g.strokeStyle = NAVY;
  g.strokeText(label, S / 2, 578);
  const goldText = g.createLinearGradient(0, 540, 0, 615);
  goldText.addColorStop(0, '#f6d67a');
  goldText.addColorStop(1, GOLD);
  g.fillStyle = goldText;
  g.fillText(label, S / 2, 578);
  g.restore();

  // Thin gold rule inside the frame
  g.strokeStyle = GOLD;
  g.lineWidth = 3;
  g.strokeRect(inset - 6, inset - 6, S - (inset - 6) * 2, S - (inset - 6) * 2);

  return c.toDataURL('image/jpeg', 0.88);
}

function pawBadge(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.fillStyle = RUST;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = GOLD;
  g.stroke();
  g.fillStyle = GOLD;
  g.beginPath();
  g.ellipse(x, y + 5, 9, 7, 0, 0, Math.PI * 2);
  g.fill();
  for (const [dx, dy] of [[-10, -6], [-4, -12], [4, -12], [10, -6]]) {
    g.beginPath();
    g.arc(x + dx, y + dy, 3.6, 0, Math.PI * 2);
    g.fill();
  }
}

/** Center-crops the photo and gives it a comic look: smoothed, posterized, inked edges. */
function stylize(img: HTMLImageElement, size: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const side = Math.min(img.width, img.height);
  g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
  const data = g.getImageData(0, 0, size, size);
  const px = data.data;
  const n = size * size;

  // Box blur twice to flatten fur texture into shapes
  const blurred = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    blurred[i * 3] = px[i * 4];
    blurred[i * 3 + 1] = px[i * 4 + 1];
    blurred[i * 3 + 2] = px[i * 4 + 2];
  }
  for (let pass = 0; pass < 3; pass++) boxBlur(blurred, size, 3);

  // Luminance for the edge lines
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = 0.299 * blurred[i * 3] + 0.587 * blurred[i * 3 + 1] + 0.114 * blurred[i * 3 + 2];

  const levels = 7;
  const step = 255 / (levels - 1);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      let r = blurred[i * 3];
      let gr = blurred[i * 3 + 1];
      let b = blurred[i * 3 + 2];
      // Boost saturation a little
      const m = (r + gr + b) / 3;
      r = m + (r - m) * 1.35;
      gr = m + (gr - m) * 1.35;
      b = m + (b - m) * 1.35;
      r = Math.round(clamp(r) / step) * step;
      gr = Math.round(clamp(gr) / step) * step;
      b = Math.round(clamp(b) / step) * step;
      let edge = 0;
      if (x > 0 && y > 0 && x < size - 1 && y < size - 1) {
        const gx = lum[i - size + 1] + 2 * lum[i + 1] + lum[i + size + 1] - lum[i - size - 1] - 2 * lum[i - 1] - lum[i + size - 1];
        const gy = lum[i + size - 1] + 2 * lum[i + size] + lum[i + size + 1] - lum[i - size - 1] - 2 * lum[i - size] - lum[i - size + 1];
        edge = Math.sqrt(gx * gx + gy * gy);
      }
      const ink = Math.min(1, Math.max(0, (edge - 110) / 70)) * 0.85;
      px[i * 4] = r * (1 - ink) + 22 * ink;
      px[i * 4 + 1] = gr * (1 - ink) + 32 * ink;
      px[i * 4 + 2] = b * (1 - ink) + 42 * ink;
    }
  }
  g.putImageData(data, 0, 0);
  return c;
}

function boxBlur(buf: Float32Array, size: number, radius: number): void {
  const tmp = new Float32Array(buf.length);
  const w = radius * 2 + 1;
  // horizontal
  for (let y = 0; y < size; y++) {
    for (let ch = 0; ch < 3; ch++) {
      let sum = 0;
      for (let x = -radius; x <= radius; x++) sum += buf[(y * size + Math.min(size - 1, Math.max(0, x))) * 3 + ch];
      for (let x = 0; x < size; x++) {
        tmp[(y * size + x) * 3 + ch] = sum / w;
        const out = Math.max(0, x - radius);
        const inn = Math.min(size - 1, x + radius + 1);
        sum += buf[(y * size + inn) * 3 + ch] - buf[(y * size + out) * 3 + ch];
      }
    }
  }
  // vertical
  for (let x = 0; x < size; x++) {
    for (let ch = 0; ch < 3; ch++) {
      let sum = 0;
      for (let y = -radius; y <= radius; y++) sum += tmp[(Math.min(size - 1, Math.max(0, y)) * size + x) * 3 + ch];
      for (let y = 0; y < size; y++) {
        buf[(y * size + x) * 3 + ch] = sum / w;
        const out = Math.max(0, y - radius);
        const inn = Math.min(size - 1, y + radius + 1);
        sum += tmp[(inn * size + x) * 3 + ch] - tmp[(out * size + x) * 3 + ch];
      }
    }
  }
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Picks the closest in-game coat color from the photo by averaging the
 * middle of the picture (where the pet usually is), weighted to the center.
 */
export function matchPalette(img: HTMLImageElement): string {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  const side = Math.min(img.width, img.height);
  g.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
  const px = g.getImageData(0, 0, size, size).data;
  // The background: the average color around the edges of the photo.
  // Pixels that look like it count for less, so a dark room or a green
  // lawn doesn't decide the pet's coat.
  let br = 0;
  let bg = 0;
  let bb = 0;
  let bn = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (x > 6 && y > 6 && x < size - 7 && y < size - 7) continue;
      const i = (y * size + x) * 4;
      br += px[i];
      bg += px[i + 1];
      bb += px[i + 2];
      bn++;
    }
  }
  br /= bn;
  bg /= bn;
  bb /= bn;
  // Collect the pixels that are probably the pet, with a weight each
  const pts: { r: number; g: number; b: number; w: number }[] = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = (x - size / 2) / (size / 2);
      const dy = (y - size / 2) / (size / 2);
      const i = (y * size + x) * 4;
      const pr = px[i];
      const pg = px[i + 1];
      const pb = px[i + 2];
      // Skip grass-green and sky-blue pixels; pets are rarely those colors
      if (pg > pr + 18 && pg > pb + 8) continue;
      if (pb > pr + 30 && pb > pg + 10) continue;
      const fromBg = Math.sqrt((pr - br) ** 2 + (pg - bg) ** 2 + (pb - bb) ** 2);
      const w = Math.exp(-(dx * dx + dy * dy) * 2.5) * Math.min(1, fromBg / 90) ** 2;
      if (w > 0.01) pts.push({ r: pr, g: pg, b: pb, w });
    }
  }
  if (pts.length < 20) return 'brown';

  // Group them into a few colors (k-means) and take the biggest group, so
  // shadows and highlights on the fur don't blend into a muddy average
  const k = 4;
  pts.sort((a, b2) => a.r + a.g + a.b - (b2.r + b2.g + b2.b));
  const centers = Array.from({ length: k }, (_, j) => ({ ...pts[Math.floor(((j + 0.5) / k) * pts.length)] }));
  const weights = new Array(k).fill(0);
  for (let iter = 0; iter < 8; iter++) {
    const acc = centers.map(() => ({ r: 0, g: 0, b: 0, w: 0 }));
    for (const q of pts) {
      let bi = 0;
      let bd = Infinity;
      centers.forEach((c, j) => {
        const d = (q.r - c.r) ** 2 + (q.g - c.g) ** 2 + (q.b - c.b) ** 2;
        if (d < bd) {
          bd = d;
          bi = j;
        }
      });
      const a = acc[bi];
      a.r += q.r * q.w;
      a.g += q.g * q.w;
      a.b += q.b * q.w;
      a.w += q.w;
    }
    acc.forEach((a, j) => {
      weights[j] = a.w;
      if (a.w > 0) centers[j] = { r: a.r / a.w, g: a.g / a.w, b: a.b / a.w, w: a.w };
    });
  }
  // Fur in shade and fur in light are the same coat: when the biggest group
  // is very dark but a lit group nearly as big has real color, use that one
  const order = centers.map((c, j) => ({ c, w: weights[j] })).sort((a, b2) => b2.w - a.w);
  let main = order[0].c;
  const lit = order.find((o) => o.w > order[0].w * 0.45 && hsl(o.c).s > 0.3 && hsl(o.c).l > 0.3);
  if (hsl(main).l < 0.2 && lit) main = lit.c;
  return coatFor(hsl(main));
}

function hsl(c: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const r = c.r / 255;
  const g = c.g / 255;
  const b = c.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return { h, s, l };
}

/** Coat color from hue, saturation and lightness, the way people name pet colors. */
function coatFor({ h, s, l }: { h: number; s: number; l: number }): string {
  if (l < 0.16) return 'black';
  if (s < 0.14 || (l > 0.85 && s < 0.4)) return l > 0.78 ? 'white' : l > 0.32 ? 'grey' : 'black';
  const warm = h < 55 || h > 340;
  if (!warm) return l > 0.6 ? 'white' : 'grey';
  if (l > 0.72) return 'cream';
  if (h < 32 && s > 0.5 && l > 0.25) return 'ginger';
  if (l > 0.42 && h >= 28) return 'golden';
  if (l < 0.22) return 'black';
  return 'brown';
}
