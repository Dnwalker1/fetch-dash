import Phaser from 'phaser';
import { bird, dot, eye, limb, patch, soft, type BirdLook } from './critters';
import { blob, circle, css, ellipse, fillOut, grain, lin, line, paint, rad, roundX, roundY, shade, type Ctx } from './paint';

/**
 * Painted critters for levels 7 to 12 (chipmunk, mouse, crow, lizard, hawk,
 * chicken, monkey, parrot, balloon) and the falling leaf and petal. Same
 * sizes and poses as the flat versions they replace. Ground critters face
 * left, toward the pet; birds fly left.
 */

export function paintCritters2(scene: Phaser.Scene): void {
  paintFlyers(scene);
  paintRunners(scene);
  paintBits(scene);
}

// ---------- Birds and the balloon ----------

function paintFlyers(scene: Phaser.Scene): void {
  const crow: BirdLook = { w: 44, h: 24, body: 0x2e2e3c, belly: 0x44445a, wing: 0x20202c, head: 0x2e2e3c, beak: 0x4a4a52, bx: 22, by: 15 };
  const parrot: BirdLook = {
    w: 48, h: 30, body: 0xd6402b, belly: 0xe8683a, wing: 0x3f9a4a, head: 0xd84a30, beak: 0xf0e8d8, bx: 22, by: 17,
    extra: (c, hx, hy) => {
      // a pale face patch around the eye
      ellipse(c, hx - 1.4, hy - 0.6, 2.8, 2.2);
      c.fillStyle = css(0xfff4ec, 0.85);
      c.fill();
    },
  };
  [true, false].forEach((up, i) => {
    paint(scene, `crow-${i}`, 44, 24, (c) => {
      bird(c, crow, up);
      // a glossy blue sheen
      const y = up ? 15 : 11;
      ellipse(c, 19, y - 2, 6, 1.4);
      c.fillStyle = css(0x6a7ab0, 0.35);
      c.fill();
      grain(c, 44, 24, 0.04, 0, 130, 64);
    });
    paint(scene, `parrot-${i}`, 48, 30, (c) => {
      const y = up ? 17 : 13;
      // long tail feathers, red and blue
      for (const [dy, col] of [[-1, 0x2f6fd0], [1.5, 0xd6402b]] as [number, number][]) {
        c.beginPath();
        c.moveTo(30, y + dy - 1.5);
        c.lineTo(47.5, y + dy + 3);
        c.lineTo(46, y + dy + 5.5);
        c.lineTo(30, y + dy + 2);
        c.closePath();
        fillOut(c, roundY(c, y + dy - 1, y + dy + 5, col, 0.25, -0.3), shade(col, -0.6), 0.9);
      }
      bird(c, parrot, up);
      // blue and yellow on the wing
      const wy = up ? 4 : y + 8;
      ellipse(c, 23, wy, 3.5, 1.6);
      c.fillStyle = css(0x2f6fd0, 0.8);
      c.fill();
      line(c, [[17, y + 1], [26, y + 1]], 0xf2c14e, 1.6, 0.9);
      grain(c, 48, 30, 0.04, 0, 131, 64);
    });
    paint(scene, `hawk-${i}`, 60, 28, (c) => hawk(c, up));
    paint(scene, `balloon-${i}`, 30, 60, (c) => {
      const lean = up ? -4 : 4;
      c.beginPath();
      c.moveTo(15, 37);
      c.bezierCurveTo(15 + lean, 44, 15 - lean, 52, 15 + lean, 60);
      c.strokeStyle = css(0xf0e8d8, 0.95);
      c.lineWidth = 1.1;
      c.stroke();
      // knot, then the balloon with a soft shine
      c.beginPath();
      c.moveTo(12.5, 36.5);
      c.lineTo(17.5, 36.5);
      c.lineTo(15, 33);
      c.closePath();
      fillOut(c, css(0xc03058), 0x7a1a34, 0.8);
      ellipse(c, 15, 18, 13, 16);
      fillOut(c, rad(c, 10, 11, 1, 15, 18, 17, [[0, 0xff9ab4], [0.45, 0xe8507a], [1, 0xa82a50]]), 0x6a1430, 1.1);
      ellipse(c, 9.5, 11, 3.2, 5.5, 0.4);
      c.fillStyle = css(0xffffff, 0.55);
      c.fill();
      dot(c, 11.5, 19, 1.1, 0xffffff, 0.35);
    });
  });
}

/** A hawk soaring left on broad wings, wings up or down. */
function hawk(c: Ctx, up: boolean): void {
  const brown = 0x7a5232;
  const out = 0x2e1c10;
  const y = up ? 16 : 12;
  // fanned tail
  c.beginPath();
  c.moveTo(40, y - 1.5);
  c.lineTo(57, y - 4);
  c.quadraticCurveTo(59.5, y + 1, 57, y + 5);
  c.lineTo(40, y + 2.5);
  c.closePath();
  fillOut(c, roundY(c, y - 4, y + 5, 0xb06a3a, 0.2, -0.3), out, 1);
  for (const k of [-2, 0.5, 3]) line(c, [[44, y + k * 0.4], [56, y + k]], 0x6a3a1a, 0.6, 0.6);
  // the far wing, darker
  const wing = (dx: number, far: boolean) => {
    c.beginPath();
    c.moveTo(20 + dx, y - 1);
    if (up) {
      c.quadraticCurveTo(24 + dx, 6, 34 + dx, 1);
      for (let f = 0; f < 4; f++) c.lineTo(37 + dx + f * 2.2, 1.5 + f * 1.6 + (f % 2) * 1.4);
      c.quadraticCurveTo(36 + dx, 9, 40 + dx, y - 1);
    } else {
      c.quadraticCurveTo(24 + dx, 22, 32 + dx, 27);
      for (let f = 0; f < 4; f++) c.lineTo(35 + dx + f * 2.2, 26.5 - f * 1.6 - (f % 2) * 1.4);
      c.quadraticCurveTo(36 + dx, 19, 40 + dx, y + 2);
    }
    c.closePath();
    const col = far ? shade(brown, -0.3) : brown;
    fillOut(c, lin(c, 0, up ? 0 : y, 0, up ? y : 28, up ? [[0, shade(col, -0.25)], [1, shade(col, 0.2)]] : [[0, shade(col, 0.2)], [1, shade(col, -0.25)]]), out, 1);
    if (!far) for (const k of [0.3, 0.55, 0.8]) {
      const fx = 22 + dx + 16 * k;
      line(c, up ? [[fx, y - 2], [fx + 3, 3 + k * 2]] : [[fx, y + 2], [fx + 3, 25 - k * 2]], 0xe8d0a8, 0.7, 0.45);
    }
  };
  wing(-6, true);
  // body and pale chest
  const body = () => ellipse(c, 30, y, 13, 5.2);
  soft(c, 30, y, 13, 5.2, brown, out, 1.1);
  patch(c, body, 26, y + 3, 10, 3, 0xf0e0c4);
  for (const x of [22, 26, 30]) dot(c, x, y + 3, 0.8, 0x7a5232, 0.6);
  wing(0, false);
  // head with a hooked yellow beak
  c.beginPath();
  c.moveTo(10.5, y - 3.2);
  c.quadraticCurveTo(5, y - 3.5, 4.5, y + 0.5);
  c.quadraticCurveTo(7.5, y - 0.2, 10, y + 0.5);
  c.closePath();
  fillOut(c, lin(c, 0, y - 3.5, 0, y + 0.5, [[0, 0xf6d070], [1, 0xc89020]]), 0x6a4a10, 0.8);
  dot(c, 5, y + 0.3, 0.6, 0x2a2a2a);
  soft(c, 14, y - 2, 5.8, 5, shade(brown, 0.08), out, 1.1);
  ellipse(c, 12, y + 0.8, 3, 1.8);
  c.fillStyle = css(0xf0e0c4, 0.8);
  c.fill();
  eye(c, 12.3, y - 3, 1.3, 0x3a2a10);
  line(c, [[10, y - 4.4], [15, y - 4.8]], 0x3a2414, 0.9, 0.7);
  grain(c, 60, 28, 0.05, 0, 132, 64);
}

// ---------- Ground critters ----------

function paintRunners(scene: Phaser.Scene): void {
  paint(scene, 'chipmunk', 36, 26, (c) => {
    const furC = 0xb5784a;
    const out = 0x4a2a14;
    // tail held up behind
    blob(c, [[27, 15], [29, 6], [32.5, 1.5], [35.5, 4], [34.5, 12], [31, 17]]);
    fillOut(c, roundX(c, 27, 36, shade(furC, -0.1), 0.25, -0.35), out, 1);
    line(c, [[30, 14], [32, 6], [33.5, 3]], 0x5e3a22, 1, 0.6);
    limb(c, [[26, 19], [28, 25]], shade(furC, -0.25), 3, out);
    const body = () => ellipse(c, 19, 16, 10.5, 6.5);
    soft(c, 19, 16, 10.5, 6.5, furC, out, 1.1);
    // the stripes down its back
    c.save();
    body();
    c.clip();
    for (const [dy, col] of [[-3.6, 0x3e2414], [-1.6, 0xf4e2c8], [0.2, 0x3e2414]] as [number, number][]) {
      c.beginPath();
      c.moveTo(10, 14 + dy);
      c.quadraticCurveTo(19, 11.5 + dy, 29, 14 + dy);
      c.strokeStyle = css(col, 0.9);
      c.lineWidth = 1.3;
      c.stroke();
    }
    c.restore();
    patch(c, body, 15, 20.5, 7, 3, 0xf4e2c8);
    limb(c, [[13, 20], [11, 25]], furC, 2.8, out);
    soft(c, 7.5, 12, 6.6, 6, furC, out, 1.1);
    soft(c, 9.5, 6.3, 2, 2.2, shade(furC, -0.1), out, 0.9);
    // face stripes, cheek, eye and nose
    line(c, [[3, 10], [9.5, 9.5]], 0x3e2414, 0.9, 0.8);
    line(c, [[3.4, 13.4], [9.5, 13]], 0xf4e2c8, 1, 0.9);
    ellipse(c, 5, 15.2, 3.2, 2.2);
    c.fillStyle = css(0xf4e2c8, 0.85);
    c.fill();
    eye(c, 5.6, 11.4, 1.5);
    dot(c, 1.4, 13.2, 0.9, 0x2b1a0d);
    grain(c, 36, 26, 0.05, 0, 140, 64);
  });

  paint(scene, 'mouse', 32, 18, (c) => {
    const grey = 0x9a9aa4;
    const out = 0x3a3a44;
    c.beginPath();
    c.moveTo(25, 12);
    c.bezierCurveTo(29, 13, 30, 8, 31.5, 4);
    c.strokeStyle = css(0xd8a0a8);
    c.lineWidth = 1.2;
    c.stroke();
    const body = () => ellipse(c, 17, 11, 9.5, 5.6);
    soft(c, 17, 11, 9.5, 5.6, grey, out, 1);
    patch(c, body, 14, 14.5, 6, 2.2, 0xe4e4ea);
    for (const x of [12, 21]) limb(c, [[x, 15], [x - 1, 17.5]], 0xd8a0a8, 1.2, shade(0xd8a0a8, -0.4));
    soft(c, 6.5, 10, 5, 4.2, grey, out, 1);
    // big round ear
    circle(c, 9, 4.6, 3.6);
    fillOut(c, css(grey), out, 0.9);
    circle(c, 9, 4.8, 2.3);
    c.fillStyle = rad(c, 9, 4.8, 0.3, 9, 4.8, 2.4, [[0, 0xf4c4cc], [1, 0xd890a0]]);
    c.fill();
    eye(c, 4.6, 9, 1.2);
    dot(c, 1.6, 11, 1, 0xe08a9a);
    for (const y of [9.5, 12.5]) line(c, [[2.5, 11], [-1, y]], 0xffffff, 0.4, 0.8);
  });

  paint(scene, 'lizard', 46, 18, (c) => {
    const green = 0x6aa84a;
    const out = 0x24481e;
    // long tapering tail
    c.beginPath();
    c.moveTo(26, 8);
    c.quadraticCurveTo(38, 7, 45.5, 11.5);
    c.quadraticCurveTo(38, 12, 26, 13);
    c.closePath();
    fillOut(c, roundY(c, 7, 13, green, 0.25, -0.35), out, 1);
    for (const pts of [[[12, 12], [9, 15], [7, 17.5]], [[24, 12], [27, 15], [29, 17.5]], [[14, 8], [11, 4], [9, 1]], [[24, 8], [27, 4], [29.5, 1]]] as [number, number][][]) {
      limb(c, pts, shade(green, -0.1), 2, out);
    }
    const body = () => ellipse(c, 18, 10, 10, 4.2);
    soft(c, 18, 10, 10, 4.2, green, out, 1);
    patch(c, body, 18, 12.5, 7, 1.6, 0xd8e8a0);
    // head
    c.beginPath();
    c.moveTo(9, 7.5);
    c.quadraticCurveTo(2, 7, 0.5, 9.5);
    c.quadraticCurveTo(2, 12, 9, 12);
    c.closePath();
    fillOut(c, roundY(c, 7, 12, green, 0.3, -0.3), out, 1);
    for (const [x, y] of [[14, 8.6], [18.5, 8.2], [23, 8.8], [30, 9.3], [35, 9.6]]) dot(c, x, y, 1.2, 0xe8c547, 0.95);
    eye(c, 4, 8.8, 1.1);
    line(c, [[1, 10.4], [4, 10.6]], out, 0.6, 0.7);
    grain(c, 46, 18, 0.05, 0, 141, 64);
  });

  paint(scene, 'chicken', 36, 36, (c) => {
    const white = 0xf8f4ea;
    const out = 0x6a5a48;
    // tail feathers up behind
    for (const [a, len] of [[-0.9, 9], [-0.5, 10], [-0.15, 8]] as [number, number][]) {
      c.save();
      c.translate(29, 18);
      c.rotate(a);
      ellipse(c, len * 0.5, 0, len * 0.6, 2.6);
      fillOut(c, lin(c, 0, -3, 0, 3, [[0, 0xffffff], [1, 0xd8d0c0]]), out, 0.9);
      c.restore();
    }
    line(c, [[16, 27], [14.5, 32], [12.5, 35.2]], 0xe8a020, 1.6);
    line(c, [[23, 27], [24, 32], [26.5, 35.2]], 0xe8a020, 1.6);
    for (const [x, s] of [[12.5, -1], [26.5, 1]] as [number, number][]) line(c, [[x - 2.2, 35.4], [x + 2.4 * s, 35.4]], 0xe8a020, 1.1);
    const body = () => ellipse(c, 20, 20, 12.5, 9);
    soft(c, 20, 20, 12.5, 9, white, out, 1.1);
    // folded wing
    c.beginPath();
    c.moveTo(17, 18);
    c.quadraticCurveTo(24, 15, 30, 19);
    c.quadraticCurveTo(25, 25.5, 17, 22);
    c.closePath();
    fillOut(c, lin(c, 0, 16, 0, 24, [[0, 0xfffcf4], [1, 0xd8cfbe]]), out, 0.9);
    for (const k of [0.3, 0.6]) line(c, [[19 + k * 9, 19], [20 + k * 8, 22.5]], 0xb8ae9c, 0.6, 0.7);
    patch(c, body, 14, 24, 7, 3.4, 0xffffff);
    // head with comb and wattle
    for (const [x, y, rr] of [[6.5, 4, 2.4], [9, 3, 2.6], [11.5, 4.2, 2.2]]) dot(c, x, y, rr, 0xd6402b);
    soft(c, 9.5, 11, 6.5, 6.4, white, out, 1);
    c.beginPath();
    c.moveTo(4, 10);
    c.lineTo(-0.5, 12);
    c.lineTo(4, 13.4);
    c.closePath();
    fillOut(c, lin(c, 0, 10, 0, 13.4, [[0, 0xf6c040], [1, 0xd89020]]), 0x8a5a10, 0.7);
    ellipse(c, 5, 15.4, 1.8, 2.8);
    c.fillStyle = css(0xd6402b);
    c.fill();
    eye(c, 7.4, 9.4, 1.3, 0x3a2410);
    grain(c, 36, 36, 0.04, 0, 142, 64);
  });

  paint(scene, 'monkey', 40, 38, (c) => {
    const brown = 0x7a5232;
    const out = 0x2e1c10;
    const face = 0xe8c8a0;
    // curly tail
    c.beginPath();
    c.moveTo(30, 24);
    c.bezierCurveTo(40, 22, 40, 8, 34, 8);
    c.bezierCurveTo(30, 8, 30, 13, 33.5, 13);
    c.strokeStyle = css(out);
    c.lineWidth = 3.6;
    c.stroke();
    c.strokeStyle = css(brown);
    c.lineWidth = 2.2;
    c.stroke();
    limb(c, [[27, 27], [30, 33], [31, 37]], shade(brown, -0.2), 3.6, out);
    limb(c, [[16, 22], [10, 26], [6, 30]], shade(brown, -0.2), 3.4, out);
    const body = () => ellipse(c, 22, 23, 10, 9);
    soft(c, 22, 23, 10, 9, brown, out, 1.1);
    patch(c, body, 20, 26, 6, 5, 0xc8a07a);
    limb(c, [[17, 29], [14, 34], [12, 37]], brown, 3.6, out);
    limb(c, [[25, 20], [30, 18], [33, 15]], brown, 3.2, out);
    // head: ears, face, eyes and a grin
    for (const x of [2.8, 17.2]) {
      circle(c, x, 11.5, 3.6);
      fillOut(c, css(brown), out, 0.9);
      dot(c, x, 11.5, 2, face);
    }
    soft(c, 10, 11, 8.6, 8.4, brown, out, 1.1);
    blob(c, [[4, 9], [8, 6], [10, 8], [12, 6], [16, 9], [16, 15], [10, 18.5], [4, 15]]);
    fillOut(c, rad(c, 8, 9, 0.5, 10, 12, 9, [[0, shade(face, 0.2)], [1, shade(face, -0.15)]]), shade(face, -0.5), 0.8);
    eye(c, 7.6, 10.4, 1.4);
    eye(c, 12.4, 10.4, 1.4);
    dot(c, 9, 13.3, 0.5, 0x5a3a20);
    dot(c, 11, 13.3, 0.5, 0x5a3a20);
    c.beginPath();
    c.arc(10, 14.2, 2.6, 0.3, Math.PI - 0.3);
    c.strokeStyle = css(0x5a2a1a);
    c.lineWidth = 0.9;
    c.stroke();
    grain(c, 40, 38, 0.05, 0, 143, 64);
  });
}

// ---------- Falling leaves and petals (tinted in the game) ----------

function paintBits(scene: Phaser.Scene): void {
  paint(scene, 'leaf', 12, 8, (c) => {
    c.beginPath();
    c.moveTo(0.5, 4);
    c.quadraticCurveTo(5, -0.5, 11.5, 4);
    c.quadraticCurveTo(5, 8.5, 0.5, 4);
    c.closePath();
    c.fillStyle = lin(c, 0, 0, 0, 8, [[0, 0xffffff], [1, 0xb8b8b8]]);
    c.fill();
    line(c, [[1, 4], [10.5, 4]], 0x8a8a8a, 0.7, 0.8);
    for (const x of [4, 7]) line(c, [[x, 4], [x + 1.5, 2]], 0x9a9a9a, 0.5, 0.7);
  });
  paint(scene, 'petal', 8, 6, (c) => {
    c.beginPath();
    c.moveTo(0.5, 3);
    c.bezierCurveTo(2, -0.5, 7.5, 0, 7.5, 2.4);
    c.lineTo(6.5, 3);
    c.lineTo(7.5, 3.6);
    c.bezierCurveTo(7.5, 6, 2, 6.5, 0.5, 3);
    c.closePath();
    c.fillStyle = rad(c, 3, 2.5, 0.3, 4, 3, 5, [[0, 0xffffff], [1, 0xd8d0d4]]);
    c.fill();
  });
}
