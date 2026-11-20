import Phaser from 'phaser';
import { blob, circle, css, ellipse, fillOut, grain, lin, line, paint, rad, roundX, roundY, rrect, shade, type Ctx } from './paint';

/**
 * Painted critters for levels 1 to 6: the chasers, the birds and other
 * distractions. Same sizes and poses as the flat versions they replace.
 * Ground critters face left, toward the pet; birds fly left.
 */


export function paintCritters(scene: Phaser.Scene): void {
  paintBirds(scene);
  paintGroundCritters(scene);
  paintNeighbors(scene);
}

// ---------- Small helpers ----------

function dot(c: Ctx, x: number, y: number, r: number, color: number, alpha = 1): void {
  circle(c, x, y, r);
  c.fillStyle = css(color, alpha);
  c.fill();
}

/** A shiny dark eye. */
function eye(c: Ctx, x: number, y: number, r: number, iris = 0x111111): void {
  circle(c, x, y, r);
  c.fillStyle = rad(c, x - r * 0.3, y - r * 0.3, 0.1, x, y, r, [[0, shade(iris, 0.35)], [1, iris]]);
  c.fill();
  dot(c, x - r * 0.35, y - r * 0.35, Math.max(0.45, r * 0.38), 0xffffff, 0.95);
}

/** A soft round shape lit from the upper left. */
function soft(c: Ctx, x: number, y: number, rx: number, ry: number, color: number, out?: number, lw = 1.1): void {
  ellipse(c, x, y, rx, ry);
  fillOut(c, rad(c, x - rx * 0.4, y - ry * 0.5, 0.5, x, y, Math.max(rx, ry) * 1.1, [[0, shade(color, 0.3)], [0.55, color], [1, shade(color, -0.3)]]), out ?? shade(color, -0.55), lw);
}

/** A pale patch (belly, chest, muzzle) with soft edges, kept inside the last shape drawn by `clip`. */
function patch(c: Ctx, clip: () => void, x: number, y: number, rx: number, ry: number, color: number): void {
  c.save();
  clip();
  c.clip();
  ellipse(c, x, y, rx, ry);
  c.fillStyle = rad(c, x, y, 0.5, x, y, Math.max(rx, ry), [[0, color, 0.95], [0.65, color, 0.7], [1, color, 0]]);
  c.fill();
  c.restore();
}

function limb(c: Ctx, pts: [number, number][], color: number, w: number, out: number): void {
  line(c, pts, out, w + 2);
  line(c, pts, color, w);
}

// ---------- Birds ----------

interface BirdLook {
  w: number;
  h: number;
  body: number;
  belly: number;
  wing: number;
  head: number;
  beak: number;
  /** body center x and the y of the body in the wings-up frame */
  bx: number;
  by: number;
  extra?: (c: Ctx, hx: number, hy: number) => void;
}

function bird(c: Ctx, b: BirdLook, up: boolean): void {
  const y = up ? b.by : b.by - 4;
  const out = shade(b.body, -0.6);
  const hx = b.bx - 11.5;
  const hy = y - 2.2;
  // tail
  c.beginPath();
  c.moveTo(b.bx + 9, y - 1);
  c.lineTo(b.bx + 17.5, y - 3.5);
  c.lineTo(b.bx + 18, y + 1.5);
  c.lineTo(b.bx + 9, y + 2.5);
  c.closePath();
  fillOut(c, roundY(c, y - 4, y + 2, b.wing, 0.2, -0.3), out, 1);
  // body with a pale belly
  const body = () => ellipse(c, b.bx, y, 12, 4.9);
  body();
  fillOut(c, rad(c, b.bx - 5, y - 3, 0.5, b.bx, y, 13, [[0, shade(b.body, 0.3)], [0.55, b.body], [1, shade(b.body, -0.3)]]), out, 1.1);
  patch(c, body, b.bx - 3, y + 3.5, 9, 3.2, b.belly);
  // head and beak
  c.beginPath();
  c.moveTo(hx - 4.4, hy - 1);
  c.lineTo(hx - 8.6, hy + 0.4);
  c.lineTo(hx - 4.4, hy + 1.8);
  c.closePath();
  fillOut(c, lin(c, 0, hy - 1, 0, hy + 2, [[0, shade(b.beak, 0.25)], [1, shade(b.beak, -0.2)]]), shade(b.beak, -0.55), 0.7);
  soft(c, hx, hy, 5.2, 5, b.head, out, 1.1);
  b.extra?.(c, hx, hy);
  eye(c, hx - 1.6, hy - 1, 1.25);
  // wing, up or down, with feather lines
  c.beginPath();
  if (up) {
    c.moveTo(b.bx - 6, y - 2.5);
    c.quadraticCurveTo(b.bx - 4, 3, b.bx - 1.5, 0.8);
    c.quadraticCurveTo(b.bx + 4, 4, b.bx + 7, y - 2.5);
  } else {
    c.moveTo(b.bx - 6, y + 1);
    c.quadraticCurveTo(b.bx - 4, b.h - 5, b.bx + 1, b.h - 0.8);
    c.quadraticCurveTo(b.bx + 4, b.h - 6, b.bx + 7, y + 1);
  }
  c.closePath();
  fillOut(c, lin(c, 0, up ? 0 : y, 0, up ? y : b.h, up ? [[0, shade(b.wing, -0.2)], [1, shade(b.wing, 0.2)]] : [[0, shade(b.wing, 0.2)], [1, shade(b.wing, -0.2)]]), out, 1);
  for (const k of [0.25, 0.5, 0.75]) {
    const fx = b.bx - 6 + 13 * k;
    line(c, up ? [[fx, y - 3], [fx + (k - 0.5) * 3, y - 3 - (y - 3) * 0.6]] : [[fx, y + 2], [fx + (k - 0.5) * 3, y + 2 + (b.h - y - 2) * 0.6]], shade(b.wing, -0.45), 0.7, 0.6);
  }
}

function paintBirds(scene: Phaser.Scene): void {
  const looks: Record<string, BirdLook> = {
    bird: { w: 40, h: 22, body: 0x4a557e, belly: 0xc9d0e4, wing: 0x323a60, head: 0x4a557e, beak: 0xf2a33a, bx: 20, by: 14 },
    gull: {
      w: 44, h: 24, body: 0xf4f4f0, belly: 0xffffff, wing: 0xb8c0cc, head: 0xf8f8f4, beak: 0xf2c23a, bx: 22, by: 15,
      extra: (c, hx, hy) => dot(c, hx - 7.2, hy + 0.9, 0.7, 0xd6402b),
    },
    pigeon: {
      w: 40, h: 24, body: 0x8a8f9e, belly: 0xa9adba, wing: 0x6b7080, head: 0x7d8292, beak: 0xd8b070, bx: 20, by: 14,
      extra: (c, hx, hy) => {
        // a shimmering green and purple neck
        ellipse(c, hx + 3.5, hy + 3.5, 3.5, 2.6);
        c.fillStyle = lin(c, hx + 1, hy + 2, hx + 6, hy + 5, [[0, 0x5aa08a], [1, 0x8a5a9a]]);
        c.fill();
      },
    },
    cardinal: {
      w: 40, h: 24, body: 0xc9302c, belly: 0xe0584a, wing: 0x9c2421, head: 0xd03630, beak: 0xf2a33a, bx: 20, by: 14,
      extra: (c, hx, hy) => {
        // crest and black mask
        c.beginPath();
        c.moveTo(hx - 1, hy - 4);
        c.lineTo(hx + 1.5, hy - 9.5);
        c.lineTo(hx + 4.5, hy - 3.5);
        c.closePath();
        fillOut(c, roundX(c, hx - 1, hx + 4.5, 0xc9302c, 0.25, -0.3), 0x5a1210, 0.9);
        ellipse(c, hx - 3, hy + 0.4, 2.6, 2.4);
        c.fillStyle = css(0x1a1a1a);
        c.fill();
      },
    },
    duck: {
      w: 44, h: 26, body: 0x8a6a4a, belly: 0xb8a088, wing: 0x6b5038, head: 0x2f7a4a, beak: 0xe8b030, bx: 24, by: 15,
      extra: (c, hx, hy) => {
        // a white collar, and a blue patch shows on the wing
        line(c, [[hx + 2.5, hy + 3.5], [hx + 4.5, hy + 5.5]], 0xffffff, 1.6, 0.95);
        ellipse(c, hx - 1, hy - 2, 2.5, 1.2);
        c.fillStyle = css(0x6fd09a, 0.45);
        c.fill();
      },
    },
  };
  for (const [name, b] of Object.entries(looks)) {
    [true, false].forEach((up, i) =>
      paint(scene, `${name}-${i}`, b.w, b.h, (c) => {
        bird(c, b, up);
        if (name === 'duck') {
          const y = up ? b.by : b.by - 4;
          rrect(c, b.bx + 1, y - 1, 5, 2.2, 1);
          c.fillStyle = css(0x3a5ab0, 0.9);
          c.fill();
        }
        grain(c, b.w, b.h, 0.04, 0, 3, 64);
      }),
    );
  }

  // butterfly: open wings, then folded
  [true, false].forEach((open, i) =>
    paint(scene, `butterfly-${i}`, 26, 22, (c) => {
      const wing = (x: number, y: number, rx: number, ry: number, color: number) => {
        ellipse(c, x, y, rx, ry);
        fillOut(c, rad(c, x, y, 0.5, x, y, Math.max(rx, ry), [[0, shade(color, 0.3)], [0.7, color], [1, shade(color, -0.35)]]), 0x2b1a0d, 1.3);
      };
      const k = open ? 1 : 0.5;
      for (const s of [-1, 1]) {
        wing(13 + s * 6 * k - s * (open ? 0 : 1), 7.5, 5.8 * k, 5.6, 0xf2a33a);
        wing(13 + s * 5 * k - s * (open ? 0 : 1), 16, 4.4 * k, 4.2, 0xe0782a);
        if (open) {
          for (const [dx, dy] of [[9.5, 4], [10.5, 8], [8, 18]]) dot(c, 13 + s * dx, dy, 0.8, 0xffffff, 0.9);
          line(c, [[13 + s * 1.5, 8], [13 + s * 8, 5]], 0x6a3a10, 0.6, 0.6);
          line(c, [[13 + s * 1.5, 9], [13 + s * 9, 10]], 0x6a3a10, 0.6, 0.6);
        }
      }
      rrect(c, 12, 4, 2.2, 15, 1.1);
      c.fillStyle = lin(c, 12, 0, 14.2, 0, [[0, 0x4a3020], [1, 0x1a0d05]]);
      c.fill();
      line(c, [[12.5, 4.5], [10.5, 1]], 0x2b1a0d, 0.7);
      line(c, [[13.7, 4.5], [15.5, 1]], 0x2b1a0d, 0.7);
    }),
  );

  // owl, seen from the front with its wings up, then down
  [true, false].forEach((up, i) =>
    paint(scene, `owl-${i}`, 50, 34, (c) => {
      const brown = 0x8a7560;
      const dark = 0x5e4c3a;
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(25 + s * 9, 17);
        if (up) {
          c.quadraticCurveTo(25 + s * 18, 2, 25 + s * 25, 3.5);
          c.quadraticCurveTo(25 + s * 19, 11, 25 + s * 10, 23);
        } else {
          c.quadraticCurveTo(25 + s * 18, 31, 25 + s * 25, 30.5);
          c.quadraticCurveTo(25 + s * 19, 22, 25 + s * 10, 13);
        }
        c.closePath();
        fillOut(c, lin(c, 25, 0, 25 + s * 25, 0, [[0, shade(dark, 0.15)], [1, shade(dark, -0.2)]]), 0x2e241a, 1);
        for (const k of [0.4, 0.65, 0.88]) {
          const x = 25 + s * (9 + 15 * k);
          line(c, up ? [[x, 4 + 12 * (1 - k)], [x - s * 2, 12 + 6 * (1 - k)]] : [[x, 30 - 12 * (1 - k)], [x - s * 2, 22 - 6 * (1 - k)]], 0xe0d0b0, 0.8, 0.5);
        }
      }
      for (const s of [-1, 1]) {
        c.beginPath();
        c.moveTo(25 + s * 4, 10);
        c.lineTo(25 + s * 8.5, 5);
        c.lineTo(25 + s * 9, 12);
        c.closePath();
        fillOut(c, css(dark), 0x2e241a, 0.9);
      }
      soft(c, 25, 20, 11, 11.5, brown, 0x2e241a, 1.2);
      for (let r = 0; r < 3; r++) for (let k = 0; k < 3 - (r % 2); k++) {
        c.beginPath();
        c.arc(21 + k * 4 + (r % 2) * 2, 24 + r * 3, 1.6, 0.2, Math.PI - 0.2);
        c.strokeStyle = css(0xe8d8b8, 0.55);
        c.lineWidth = 0.8;
        c.stroke();
      }
      for (const s of [-1, 1]) {
        circle(c, 25 + s * 5, 15, 5);
        c.fillStyle = rad(c, 25 + s * 5, 15, 1, 25 + s * 5, 15, 5.2, [[0, 0xfff4dc], [1, 0xd8c4a0]]);
        c.fill();
        circle(c, 25 + s * 5, 15, 3);
        c.fillStyle = rad(c, 24 + s * 5, 14, 0.3, 25 + s * 5, 15, 3, [[0, 0xffd860], [1, 0xd89a20]]);
        c.fill();
        eye(c, 25 + s * 5, 15, 1.5);
      }
      c.beginPath();
      c.moveTo(23, 18.5);
      c.lineTo(27, 18.5);
      c.lineTo(25, 22.5);
      c.closePath();
      c.fillStyle = lin(c, 0, 18.5, 0, 22.5, [[0, 0xe8b850], [1, 0xa87020]]);
      c.fill();
    }),
  );
}

// ---------- Ground critters ----------

function paintGroundCritters(scene: Phaser.Scene): void {
  paint(scene, 'squirrel', 44, 32, (c) => {
    const furC = 0x9a7356;
    const out = 0x3e2a1c;
    // big bushy tail curling up behind
    blob(c, [[27, 26], [26, 14], [30, 3.5], [38, 1.5], [43.5, 8], [42.5, 18], [40.5, 28], [33, 29]]);
    fillOut(c, rad(c, 34, 8, 1, 35, 15, 17, [[0, 0x9a7a5e], [0.6, 0x6b4d38], [1, 0x4a3426]]), out, 1.2);
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + i * 0.35;
      line(c, [[35 + Math.cos(a) * 4, 14 + Math.sin(a) * 6], [35 + Math.cos(a) * 9, 14 + Math.sin(a) * 12]], 0xc8a888, 0.8, 0.45);
    }
    const body = () => ellipse(c, 20, 22, 11, 7);
    soft(c, 20, 22, 11, 7, furC, out, 1.2);
    patch(c, body, 15, 26, 7, 3.5, 0xf0dcc0);
    limb(c, [[25, 25], [27, 30.5]], shade(furC, -0.2), 3.4, out);
    limb(c, [[14, 26], [12, 30.5]], furC, 3.2, out);
    // head, ear tuft, eye, nose
    c.beginPath();
    c.moveTo(9.5, 10.5);
    c.lineTo(12, 3.5);
    c.lineTo(14, 10.5);
    c.closePath();
    fillOut(c, css(furC), out, 1);
    soft(c, 9, 16, 7, 6.5, furC, out, 1.2);
    ellipse(c, 4.5, 18.5, 3.6, 2.6);
    c.fillStyle = css(0xf0dcc0, 0.85);
    c.fill();
    eye(c, 6.4, 14.5, 1.7);
    dot(c, 1.6, 17.6, 1.1, 0x2b1a0d);
    line(c, [[2.5, 19.5], [4.5, 20]], 0x2b1a0d, 0.7, 0.6);
    grain(c, 44, 32, 0.05, 0, 3, 64);
  });

  paint(scene, 'gopher', 26, 28, (c) => {
    const furC = 0x9a7b5c;
    const out = 0x3e2c1c;
    for (const x of [5, 21]) soft(c, x, 6, 3.6, 3.6, shade(furC, -0.05), out, 1);
    for (const x of [5, 21]) dot(c, x, 6.3, 1.7, 0xd89a90);
    rrect(c, 1, 4, 24, 24, 10);
    fillOut(c, rad(c, 9, 9, 1, 13, 15, 18, [[0, shade(furC, 0.3)], [0.55, furC], [1, shade(furC, -0.3)]]), out, 1.2);
    ellipse(c, 13, 18.5, 7, 5);
    c.fillStyle = rad(c, 13, 18, 0.5, 13, 18.5, 7, [[0, 0xf4e2c8], [0.7, 0xe0c8a8], [1, 0xe0c8a8, 0]]);
    c.fill();
    eye(c, 9, 12, 2);
    eye(c, 17, 12, 2);
    dot(c, 13, 16, 1.5, 0x5a3a30);
    rrect(c, 11, 18.5, 4, 4.4, 0.8);
    fillOut(c, css(0xfffaf0), 0xb0a090, 0.6);
    line(c, [[13, 18.6], [13, 22.8]], 0xb0a090, 0.5);
    for (const x of [7, 19]) soft(c, x, 25, 3, 2, shade(furC, -0.1), out, 0.9);
  });

  paint(scene, 'rabbit', 40, 36, (c) => {
    const furC = 0xa48a74;
    const out = 0x4a3a2e;
    for (const [x, tilt] of [[15, 0.2], [10, -0.05]] as [number, number][]) {
      ellipse(c, x, 6.5, 2.7, 7.8, tilt);
      fillOut(c, roundX(c, x - 3, x + 3, x === 15 ? shade(furC, -0.12) : furC), out, 1);
      ellipse(c, x, 7, 1.1, 5.4, tilt);
      c.fillStyle = lin(c, 0, 2, 0, 12, [[0, 0xf4c4c4], [1, 0xd89a9a]]);
      c.fill();
    }
    soft(c, 36, 22, 4.8, 4.6, 0xffffff, 0xb8b0a8, 1);
    const body = () => ellipse(c, 23, 25, 13, 8.8);
    soft(c, 23, 25, 13, 8.8, furC, out, 1.2);
    patch(c, body, 17, 30, 8, 3.5, 0xe8dccc);
    soft(c, 30, 32.5, 6, 2.6, shade(furC, -0.15), out, 1);
    soft(c, 14, 33, 3.2, 2.2, furC, out, 1);
    soft(c, 10, 18, 8, 7.6, furC, out, 1.2);
    ellipse(c, 5, 21, 3.6, 2.6);
    c.fillStyle = css(0xf0e6da, 0.85);
    c.fill();
    eye(c, 7.2, 16.5, 1.8);
    dot(c, 2.4, 19.6, 1, 0xd88a8a);
    for (const [x, y] of [[-2, 18.5], [-2, 21.5]]) line(c, [[4, 20.5], [x + 2, y]], 0xffffff, 0.5, 0.8);
    grain(c, 40, 36, 0.05, 0, 5, 64);
  });

  paint(scene, 'crab', 42, 28, (c) => {
    const red = 0xe0603a;
    const out = 0x7a2a14;
    for (const s of [-1, 1]) {
      for (const [a, b, d] of [[[10, 20], [17, 23], [18, 27.5]], [[7, 22], [11, 25], [12, 28]], [[11, 15], [15, 13], [16, 8]]] as [number, number][][]) {
        limb(c, [[21 + s * a[0], a[1]], [21 + s * b[0], b[1]], [21 + s * d[0], d[1]]], shade(red, -0.08), 2.2, out);
      }
      // claw: a big pincer with a notch
      c.save();
      c.translate(21 + s * 16, 6);
      c.scale(s, 1);
      c.beginPath();
      c.moveTo(-1, 3);
      c.bezierCurveTo(-6, 2, -6, -6, 0, -5.5);
      c.lineTo(-1.5, -1.5);
      c.lineTo(3, -4);
      c.bezierCurveTo(6, 0, 4, 5, -1, 3);
      c.closePath();
      fillOut(c, rad(c, -2, -3, 0.5, 0, 0, 7, [[0, shade(red, 0.35)], [0.6, red], [1, shade(red, -0.3)]]), out, 1.1);
      c.restore();
    }
    soft(c, 21, 18, 13, 7.2, red, out, 1.3);
    for (const [x, y] of [[15, 15], [26, 14.5], [21, 19.5]]) dot(c, x, y, 1.1, 0xf6a080, 0.8);
    for (const x of [17, 25]) {
      line(c, [[x, 12], [x - (x - 21) * 0.2, 5.5]], out, 2.2);
      line(c, [[x, 12], [x - (x - 21) * 0.2, 5.5]], red, 1.2);
      circle(c, x - (x - 21) * 0.2, 5, 2.2);
      c.fillStyle = css(0xffffff);
      c.fill();
      eye(c, x - (x - 21) * 0.2 + 0.3, 5.2, 1.3);
    }
    c.beginPath();
    c.arc(21, 19.5, 3, 0.3, Math.PI - 0.3);
    c.strokeStyle = css(out, 0.7);
    c.lineWidth = 0.9;
    c.stroke();
  });

  paint(scene, 'frog', 34, 26, (c) => {
    const green = 0x5aa14a;
    const out = 0x24481e;
    for (const x of [6, 28]) soft(c, x, 22.5, 6, 2.6, 0x3f7a33, out, 1);
    const body = () => ellipse(c, 17, 17, 13, 7);
    soft(c, 17, 17, 13, 7, green, out, 1.2);
    patch(c, body, 17, 22, 9, 3.5, 0xd8e8a8);
    for (const [x, y, r] of [[12, 15, 1.6], [22, 13.5, 1.3], [17, 17.5, 1.1], [26, 17, 1]]) dot(c, x, y, r, 0x3a7a2e, 0.7);
    for (const x of [9, 21]) {
      soft(c, x, 8, 6, 6, green, out, 1.1);
      circle(c, x, 7, 3.2);
      c.fillStyle = css(0xffffff);
      c.fill();
      eye(c, x - 0.5, 7, 1.7);
    }
    c.beginPath();
    c.moveTo(9, 15.5);
    c.quadraticCurveTo(15, 19, 22, 15.5);
    c.strokeStyle = css(out, 0.8);
    c.lineWidth = 1;
    c.stroke();
    for (const x of [10.5, 12]) dot(c, x, 12.5, 0.45, out);
  });

  paint(scene, 'streetcat', 44, 32, (c) => {
    const grey = 0x6f6a72;
    const out = 0x2a262c;
    limb(c, [[36, 18], [40, 12], [42, 6]], grey, 3.6, out);
    limb(c, [[30, 24], [26, 30.5]], shade(grey, -0.2), 3.2, out);
    limb(c, [[14, 24], [8, 30.5]], shade(grey, -0.2), 3.2, out);
    const body = () => ellipse(c, 24, 20, 13, 6.5);
    soft(c, 24, 20, 13, 6.5, grey, out, 1.2);
    for (const x of [20, 25, 30]) line(c, [[x, 14.5], [x + 1.5, 19]], shade(grey, -0.35), 1.4, 0.7);
    patch(c, body, 18, 24.5, 8, 3, 0xb8b2bc);
    limb(c, [[34, 24], [38, 30.5]], grey, 3.2, out);
    limb(c, [[20, 25], [22, 30.5]], grey, 3.2, out);
    for (const [a, b, d] of [[[4, 10], [6, 1], [11, 7]], [[11, 7], [15, 0.5], [17, 9]]] as [number, number][][]) {
      c.beginPath();
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.lineTo(d[0], d[1]);
      c.closePath();
      fillOut(c, css(grey), out, 1);
    }
    soft(c, 10, 14, 8, 7.6, grey, out, 1.2);
    eye(c, 7, 13, 1.8, 0xe8d36a);
    ellipse(c, 7.2, 13, 0.5, 1.4);
    c.fillStyle = css(0x111111);
    c.fill();
    dot(c, 3, 16.5, 0.9, 0xe08a9a);
    for (const y of [16, 18]) line(c, [[4, 17], [-1, y]], 0xffffff, 0.5, 0.7);
  });

  paint(scene, 'streetdog', 48, 38, (c) => {
    const brown = 0x8a6a4a;
    const out = 0x3a2a1c;
    limb(c, [[42, 18], [45, 12], [47, 8]], brown, 4, out);
    limb(c, [[22, 28], [24, 36.5]], shade(brown, -0.2), 4, out);
    limb(c, [[40, 26], [44, 36.5]], shade(brown, -0.2), 4, out);
    const body = () => ellipse(c, 28, 22, 15, 8);
    soft(c, 28, 22, 15, 8, brown, out, 1.3);
    // scruffy fur
    for (let i = 0; i < 9; i++) line(c, [[15 + i * 3.3, 15.5 + (i % 2)], [17.5 + i * 3.3, 14.6 + (i % 2)]], shade(brown, i % 2 ? 0.3 : -0.3), 0.9, 0.55);
    patch(c, body, 22, 27, 9, 3.5, 0xc8a882);
    limb(c, [[16, 28], [10, 36.5]], brown, 4, out);
    limb(c, [[34, 28], [30, 36.5]], brown, 4, out);
    soft(c, 11, 15, 10, 9.5, brown, out, 1.3);
    ellipse(c, 4, 18.5, 5, 3.8);
    fillOut(c, rad(c, 3, 17, 0.5, 4, 18.5, 5.5, [[0, 0xd8b890], [1, 0xa88a68]]), out, 1);
    // barking: open mouth with a tooth
    c.beginPath();
    c.moveTo(0.5, 20.5);
    c.lineTo(7, 21);
    c.lineTo(3, 24.5);
    c.closePath();
    c.fillStyle = css(0x5a1a1a);
    c.fill();
    c.beginPath();
    c.moveTo(3, 21);
    c.lineTo(5.5, 21);
    c.lineTo(4.2, 23.2);
    c.closePath();
    c.fillStyle = css(0xffffff);
    c.fill();
    ellipse(c, 15.5, 10.5, 3.8, 7, 0.25);
    fillOut(c, roundX(c, 12, 19, 0x5e4630), out, 1);
    dot(c, 1, 17, 2.3, 0x1a1a1a);
    dot(c, 0.3, 16.2, 0.7, 0xffffff, 0.6);
    eye(c, 9, 12, 1.7);
    line(c, [[7, 9.5], [11, 10]], out, 1.1, 0.8);
    grain(c, 48, 38, 0.06, 0, 7, 64);
  });

  paint(scene, 'fox', 50, 34, (c) => {
    const orange = 0xd9692a;
    const out = 0x5a2a10;
    // bushy tail with a white tip
    blob(c, [[36, 17], [41, 10.5], [48.5, 9], [49.5, 13.5], [46, 18.5], [39, 20]]);
    fillOut(c, roundY(c, 9, 20, orange, 0.25, -0.3), out, 1.1);
    c.save();
    blob(c, [[36, 17], [41, 10.5], [48.5, 9], [49.5, 13.5], [46, 18.5], [39, 20]]);
    c.clip();
    circle(c, 50, 12.5, 4.5);
    c.fillStyle = css(0xfff8f0);
    c.fill();
    c.restore();
    limb(c, [[32, 25], [28, 33]], 0x2b1a0d, 2.8, 0x1a0d05);
    limb(c, [[16, 25], [12, 33]], 0x2b1a0d, 2.8, 0x1a0d05);
    const body = () => ellipse(c, 26, 20, 14, 7);
    soft(c, 26, 20, 14, 7, orange, out, 1.2);
    patch(c, body, 18, 25, 8, 3, 0xfff4e8);
    limb(c, [[36, 24], [40, 33]], 0x3a2414, 2.8, 0x1a0d05);
    limb(c, [[22, 25], [24, 33]], 0x3a2414, 2.8, 0x1a0d05);
    for (const pts of [[[6, 9], [9, 0.5], [13, 8]], [[12, 8], [17, 0.5], [18, 10]]] as [number, number][][]) {
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      fillOut(c, lin(c, 0, 0, 0, 9, [[0, 0x2b1a0d], [0.4, orange], [1, orange]]), out, 0.9);
    }
    soft(c, 11, 15, 8, 7.5, orange, out, 1.2);
    // pointed snout with a white cheek
    c.beginPath();
    c.moveTo(6, 13);
    c.lineTo(0.5, 18);
    c.lineTo(8, 21);
    c.closePath();
    fillOut(c, lin(c, 0, 13, 0, 21, [[0, orange], [0.5, 0xfff4e8], [1, 0xfff4e8]]), out, 0.9);
    dot(c, 1.3, 17.8, 1.3, 0x111111);
    eye(c, 9.5, 13, 1.5);
    grain(c, 50, 34, 0.05, 0, 9, 64);
  });
}

// ---------- People ----------

function paintNeighbors(scene: Phaser.Scene): void {
  [true, false].forEach((armUp, i) =>
    paint(scene, `person-${i}`, 34, 64, (c) => {
      const skin = 0xe8b48a;
      const shirt = 0xc0552f;
      const jeans = 0x3a4a6b;
      const out = 0x2a1e18;
      for (const x of [11, 18]) {
        rrect(c, x, 38, 5, 23, 1.5);
        fillOut(c, roundX(c, x, x + 5, jeans, 0.25, -0.35), out, 0.9);
        rrect(c, x - 0.5, 60, 6.5, 3.5, 1.5);
        fillOut(c, css(0x3a2a20), out, 0.8);
      }
      limb(c, [[10, 22], [8, 29], [6, 36]], shirt, 4, out);
      dot(c, 6, 37, 2.2, skin);
      rrect(c, 8, 18, 18, 24, 5);
      fillOut(c, roundX(c, 8, 26, shirt, 0.3, -0.35), out, 1.1);
      line(c, [[13, 19], [17, 23], [21, 19]], shade(shirt, -0.35), 1, 0.7);
      const hand: [number, number] = armUp ? [31, 7] : [33, 13];
      limb(c, armUp ? [[24, 22], [28.5, 15], hand] : [[24, 22], [29, 17.5], hand], shirt, 4, out);
      circle(c, hand[0], hand[1], 2.7);
      fillOut(c, css(skin), shade(skin, -0.45), 0.8);
      circle(c, 17, 11.5, 7);
      fillOut(c, rad(c, 15, 9, 0.5, 17, 11.5, 7.5, [[0, shade(skin, 0.2)], [0.7, skin], [1, shade(skin, -0.2)]]), shade(skin, -0.5), 1);
      c.beginPath();
      c.moveTo(9.8, 11);
      c.bezierCurveTo(9, 2, 25, 1.5, 24.3, 10.5);
      c.quadraticCurveTo(21, 6.5, 15, 8);
      c.quadraticCurveTo(12, 9, 9.8, 11);
      c.closePath();
      fillOut(c, lin(c, 0, 3, 0, 11, [[0, 0x6a4a36], [1, 0x3a2618]]), 0x2a1a10, 0.9);
      dot(c, 14.6, 12, 0.9, 0x1a1a1a);
      dot(c, 19.4, 12, 0.9, 0x1a1a1a);
      c.beginPath();
      c.arc(17, 13.8, 2.2, 0.35, Math.PI - 0.35);
      c.strokeStyle = css(0x8a3a2a, 0.9);
      c.lineWidth = 0.9;
      c.stroke();
      dot(c, 13, 14.5, 1.2, 0xf08a7a, 0.35);
      dot(c, 21, 14.5, 1.2, 0xf08a7a, 0.35);
    }),
  );
}

