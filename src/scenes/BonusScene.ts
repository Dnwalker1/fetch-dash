import Phaser from 'phaser';
import { markArt, queueArt } from '../art/artFiles';
import { LAWN_TOP, halfWidthAt, paintBonusArt } from '../art/bonusArt';
import { artScale } from '../art/paint';
import { petFrameUrls, petLookFor, type PetLook } from '../art/petLook';
import { SIZE_SCALE, loadPet, savePet, type PetChoice } from '../art/pets';
import { paintTreats } from '../art/props';
import { marksFor, queueSheet, sheetFor } from '../art/sheets';
import * as sfx from '../audio/sfx';
import { BONUS, GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from '../config';
import { cap, displayName, loadHero } from '../hero/store';
import { loadProgress, saveProgress, type Progress } from '../levels';
import { cardsOpen, closeCards, openBonusEnd, type CardHost } from '../ui/cards';

/**
 * Backyard Toss, the bonus round: swipe up to throw the ball, steer the pet
 * after it, bring it back to the glowing circle, and grab the golden treats
 * on the way. The camera looks down the lawn at an angle: things higher up
 * the screen are farther away, so they're drawn smaller and behind nearer
 * things, and they move more slowly on screen (see depthScale).
 *
 * TEXTURES. Every picture this round uses, so a painted one can replace the
 * code-painted placeholder. Paint it at twice the size listed here, save it
 * as public/art/bonus/<key>.webp and add the key to BONUS_ART in
 * src/art/artFiles.ts.
 *
 *   key             size (game px)  what it is
 *   toss-sky        960 x 140       sky, far hills and trees, with the back fence along the bottom (y 113 to 134)
 *   toss-lawn       960 x 422       the lawn, drawn from y 118 down: a trapezoid, narrow at the back fence
 *                                   (y 132, 470 wide) and wide at the bottom of the screen (see BONUS in config.ts)
 *   toss-hedge      300 x 422       the garden border down the left side of the lawn; flipped for the right side
 *   toss-ring       152 x 64        the glowing circle to bring the ball back to
 *   toss-pile       36 x 22         a little pile of three golden bones (dogs)
 *   toss-pile-cat   36 x 22         the same with golden fish (cats)
 *   toss-yarn       26 x 26         the ball of yarn cats get instead of a ball
 *   toss-sprinkler  30 x 22         the lawn sprinkler
 *   toss-drop       8 x 8           one water drop from the sprinkler
 *   toss-shadow     40 x 14         a ball's shadow on the grass (it shrinks and fades as the ball goes up)
 *
 * Shared with the runner (already painted): ball (28 x 28) and the pet's shadow (shadow, 64 x 14).
 * The pet uses its side-view run frames for now, flipped to face the way it
 * runs and scaled by depth. 3/4-view runs in 8 directions come later.
 */
export const BONUS_TEXTURES = [
  'toss-sky', 'toss-lawn', 'toss-hedge', 'toss-ring', 'toss-pile', 'toss-pile-cat', 'toss-yarn', 'toss-sprinkler', 'toss-drop', 'toss-shadow',
];

// TODO(cats): a second mode with a toy on a string (a feather wand). The
// player drags the wand around the lawn and the cat chases it and pounces.
// Not part of this draft.

type Img = Phaser.GameObjects.Image;
type Phase = 'ready' | 'fetch' | 'over';
type Point = { x: number; y: number };

/** A ball's place: x and y on the lawn (screen pixels) and z, its height above it. */
interface Flight {
  x: number;
  y: number;
  z: number;
  /** speeds along the ground at full size; shrunk on screen with depth */
  vx: number;
  vy: number;
  vz: number;
  bounces: number;
  rolling: boolean;
  /** has touched the ground since it was thrown */
  landed: boolean;
}

interface Ball extends Flight {
  state: 'tee' | 'free' | 'mouth' | 'home';
  img: Img;
  shadow: Img;
  airCaught: boolean;
  thrownAt: number;
  from: Point;
  trail: { x: number; y: number; t: number }[];
}

interface Pile {
  x: number;
  y: number;
  img: Img;
  active: boolean;
  backAt: number;
}

interface Bounce {
  bounce: number;
  grip: number;
  friction: number;
  bounces: number;
}

const CX = GAME_WIDTH / 2;
const RING = BONUS.ring;
/** Where the balls wait for the next throw, and where the pet sits beside them. */
const TEE = { x: RING.x, y: RING.y + 4 };
const SIT = { x: RING.x + 86, y: RING.y - 8 };
/** Pet size here next to the runner's (times its Size and the depth). */
const PET_BASE = 0.9;
/** A ball's radius in its picture, in game px at full size. */
const BALL_R = 13;
/** Ball size next to its picture, at full depth. */
const BALL_SIZE = { dog: 0.62, cat: 0.72 };
/** Throws go at most this far (radians) either side of straight up the lawn. */
const MAX_AIM = 1.05;
const WALL_BOUNCE = 0.5;
const LAUNCH_Z = 12;
/** A thrown ball can't be grabbed until it's been gone this long (so it isn't caught at the thrower's feet). */
const GRAB_GRACE_MS = 300;
/** Shortest drag that counts as a throw, in game pixels. */
const SWIPE_MIN = 26;
/** The pet eases off within this distance of where it's going. */
const ARRIVE = 60;
const PILE_TREATS = 3;
const PILE_REACH = 34;
const PILE_BACK_MS = 2500;
const TRAIL_MS = 2000;
const YARN_COLOR = 0xe2557a;
const FIELD_MID = (BONUS.fieldTop + BONUS.fieldBottom) / 2;
const HUD = 2000;
const FONT = { fontFamily: 'Arial, sans-serif', resolution: RENDER_SCALE };
const INK = '#16202a';

/** How big things are at a screen height: small at the horizon, big at the bottom. */
export function depthScale(y: number): number {
  const t = Phaser.Math.Clamp((y - BONUS.horizonY) / (GAME_HEIGHT - BONUS.horizonY), 0, 1);
  return Phaser.Math.Linear(BONUS.farScale, BONUS.nearScale, t);
}

/** How far a thing at this height can go from the middle, keeping `margin` (full-size px) off the hedges. */
function halfWidth(y: number, margin: number): number {
  return Math.min(halfWidthAt(y) - margin * depthScale(y), CX - 18);
}

/** Distance on the ground between two spots, at full size (so far apart up the lawn counts for more). */
function groundDist(ax: number, ay: number, bx: number, by: number): number {
  const ds = depthScale((ay + by) / 2);
  return Math.hypot((bx - ax) / ds, (by - ay) / (ds * BONUS.ySquash));
}

/** Moves a spot by a ground speed for dt seconds: slower on screen the farther away it is. */
function slide(o: Point, vx: number, vy: number, dt: number): void {
  const ds = depthScale(o.y);
  o.x += vx * ds * dt;
  o.y += vy * ds * BONUS.ySquash * dt;
}

/**
 * Where the nose tip is in a pet picture (pets face right), as shares of the
 * picture's width and height, found once from its pixels: the frontmost
 * solid column in the top two thirds. Works for the code-drawn pets and the
 * painted sheets alike, and for each run frame and the jump.
 */
const noses = new Map<string, Point>();
function noseOf(scene: Phaser.Scene, key: string, frame: string | number): Point {
  const id = `${key}#${frame}`;
  const known = noses.get(id);
  if (known) return known;
  let nose: Point = { x: 0.92, y: 0.4 };
  try {
    const f = scene.textures.getFrame(key, frame);
    const w = Math.round(f.cutWidth);
    const h = Math.round(f.cutHeight);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(f.source.image as CanvasImageSource, f.cutX, f.cutY, w, h, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h).data;
    const rows = Math.floor(h * 0.68);
    for (let x = w - 1; x >= 0; x--) {
      let sum = 0;
      let n = 0;
      for (let y = 0; y < rows; y++) {
        if (px[(y * w + x) * 4 + 3] > 140) {
          sum += y;
          n++;
        }
      }
      if (n >= 2) {
        nose = { x: (x + 1) / w, y: sum / n / h };
        break;
      }
    }
  } catch {
    // can't read the pixels: keep the guess
  }
  noses.set(id, nose);
  return nose;
}

/**
 * One step of a ball's flight: its height by hand (gravity, a bounce that
 * loses most of its speed, then rolling with friction), and its spot on the
 * lawn, bouncing off the back fence, the hedges and the near edge.
 */
function stepBall(b: Flight, dt: number, k: Bounce): { landed?: boolean; bounced?: boolean; wall?: boolean } {
  const ev: { landed?: boolean; bounced?: boolean; wall?: boolean } = {};
  if (!b.rolling) {
    b.vz -= BONUS.gravity * dt;
    b.z += b.vz * dt;
    if (b.z <= 0) {
      b.z = 0;
      if (!b.landed) ev.landed = true;
      b.landed = true;
      b.bounces++;
      const up = -b.vz * k.bounce;
      if (b.bounces > k.bounces || up < 60) {
        b.rolling = true;
        b.vz = 0;
      } else {
        b.vz = up;
        ev.bounced = true;
      }
      // the grass takes some of its speed at each bounce
      b.vx *= k.grip;
      b.vy *= k.grip;
    }
  } else {
    const sp = Math.hypot(b.vx, b.vy);
    const slow = k.friction * dt;
    if (sp <= slow) {
      b.vx = 0;
      b.vy = 0;
    } else {
      b.vx -= (b.vx / sp) * slow;
      b.vy -= (b.vy / sp) * slow;
    }
  }
  slide(b, b.vx, b.vy, dt);
  const fast = Math.hypot(b.vx, b.vy) > 80;
  if (b.y < BONUS.fieldTop) {
    b.y = BONUS.fieldTop;
    b.vy = Math.abs(b.vy) * WALL_BOUNCE;
    ev.wall = fast;
  } else if (b.y > BONUS.fieldBottom) {
    b.y = BONUS.fieldBottom;
    b.vy = -Math.abs(b.vy) * WALL_BOUNCE;
    ev.wall = fast;
  }
  const hw = halfWidth(b.y, 14);
  if (b.x < CX - hw) {
    b.x = CX - hw;
    b.vx = Math.abs(b.vx) * WALL_BOUNCE;
    ev.wall = fast;
  } else if (b.x > CX + hw) {
    b.x = CX + hw;
    b.vx = -Math.abs(b.vx) * WALL_BOUNCE;
    ev.wall = fast;
  }
  return ev;
}

/** A throw's ground speed and lift for an aim (radians off straight up the lawn) and power (0 to 1). */
function launchSpeeds(angle: number, power: number): { vx: number; vy: number; vz: number } {
  const s = Phaser.Math.Linear(BONUS.throwSpeed[0], BONUS.throwSpeed[1], power);
  return { vx: Math.sin(angle) * s, vy: -Math.cos(angle) * s, vz: Phaser.Math.Linear(BONUS.throwLift[0], BONUS.throwLift[1], power) };
}

/** Each ball's turn and power next to the aimed throw, for 1, 2 or 3 balls at once. */
const SPREAD: [number, number][][] = [
  [[0, 1]],
  [[-0.2, 1], [0.2, 0.78]],
  [[-0.3, 0.85], [0, 1], [0.3, 0.68]],
];

export class BonusScene extends Phaser.Scene {
  private progress!: Progress;
  private choice!: PetChoice;
  private look!: PetLook;
  private kind!: Bounce;
  private ballKey!: string;
  private after?: number;
  private phase: Phase = 'ready';
  private paused = false;
  /** ms of play so far (stops while paused) */
  private clock = 0;
  private started = false;
  private timeLeft = 0;
  private readyAt = 0;

  private pet!: { x: number; y: number; vx: number; vy: number; face: number };
  private sizeF = 1;
  private petSprite!: Phaser.GameObjects.Sprite;
  private petMarks: Phaser.GameObjects.Sprite[] = [];
  private petShadow!: Img;
  private hopAt = -1e9;
  private stride = 0;
  private carrying?: Ball;
  private balls: Ball[] = [];
  private piles: Pile[] = [];
  private ring!: Img;
  private ringPulse!: Phaser.Tweens.Tween;
  private trailG!: Phaser.GameObjects.Graphics;
  private aimG!: Phaser.GameObjects.Graphics;

  private sprinkler!: Img;
  private spray!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sprinklerOn = false;
  private sprinklerNext = 0;

  // input
  private drag?: { id: number; x0: number; y0: number; x: number; y: number; samples: { x: number; y: number; t: number }[] };
  private steer?: { id: number; x: number; y: number };
  private autoUntil = 0;
  private autoBall?: Ball;
  private keys!: Record<'LEFT' | 'RIGHT' | 'UP' | 'DOWN' | 'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private aimAngle = 0;
  private keyAim = false;
  private charging = false;
  private charge = 0;
  private uiTap = false;

  // score
  private returned = 0;
  private airCatches = 0;
  private golden = 0;
  private streakRun = 0;
  private streaks = 0;
  private total = 0;
  private shown = new Set<string>();

  // HUD
  private timerText!: Phaser.GameObjects.Text;
  private treatText!: Phaser.GameObjects.Text;
  private ballText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private subText!: Phaser.GameObjects.Text;
  private subPill!: Phaser.GameObjects.Graphics;
  private toastText!: Phaser.GameObjects.Text;
  private pauseText!: Phaser.GameObjects.Text;
  private finger?: Phaser.GameObjects.Text;
  private frameCache = new Map<string, string[]>();

  constructor() {
    // No gravity here: the ball's height is worked out by hand (stepBall)
    super({ key: 'bonus', physics: { arcade: { gravity: { x: 0, y: 0 } } } });
  }

  preload(): void {
    const pet = loadPet();
    const sheet = sheetFor(pet);
    if (sheet) queueSheet(this, sheet, marksFor(sheet, pet));
    queueArt(this, ['ball', ...BONUS_TEXTURES]);
  }

  create(data?: { after?: number }): void {
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.after = data?.after;
    this.progress = loadProgress();
    this.choice = loadPet();
    const cat = this.choice.species === 'cat';
    this.kind = BONUS[this.choice.species];
    this.ballKey = cat ? 'toss-yarn' : 'ball';
    this.phase = 'ready';
    this.paused = false;
    this.clock = 0;
    this.started = false;
    this.timeLeft = BONUS.roundSeconds * 1000;
    this.readyAt = 0;
    this.balls = [];
    this.piles = [];
    this.carrying = undefined;
    this.drag = undefined;
    this.steer = undefined;
    this.autoUntil = 0;
    this.aimAngle = 0;
    this.keyAim = false;
    this.charging = false;
    this.returned = this.airCatches = this.golden = this.streakRun = this.streaks = this.total = 0;
    this.shown = new Set();
    this.hopAt = -1e9;

    markArt(this);
    paintTreats(this); // the shadow (and the ball, if its picture didn't load)
    paintBonusArt(this);

    // The yard: sky and back fence, the lawn, the garden borders, the circle
    this.add.image(0, 0, 'toss-sky').setOrigin(0, 0).setScale(artScale(this, 'toss-sky')).setDepth(-30);
    this.add.image(0, LAWN_TOP, 'toss-lawn').setOrigin(0, 0).setScale(artScale(this, 'toss-lawn')).setDepth(-25);
    this.add.image(0, LAWN_TOP, 'toss-hedge').setOrigin(0, 0).setScale(artScale(this, 'toss-hedge')).setDepth(-20);
    this.add.image(GAME_WIDTH, LAWN_TOP, 'toss-hedge').setOrigin(1, 0).setScale(artScale(this, 'toss-hedge')).setFlipX(true).setDepth(-20);
    const rs = artScale(this, 'toss-ring');
    this.ring = this.add.image(RING.x, RING.y, 'toss-ring').setScale(rs).setDepth(-5).setAlpha(0.8);
    this.ringPulse = this.tweens.add({ targets: this.ring, alpha: 1, scale: rs * 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.trailG = this.add.graphics().setDepth(-4);
    this.aimG = this.add.graphics().setDepth(HUD - 10);

    // The sprinkler, and its spray (an oscillating fan of drops)
    const sp = BONUS.sprinkler;
    const sds = depthScale(sp.y);
    this.sprinkler = this.add.image(sp.x, sp.y, 'toss-sprinkler').setOrigin(0.5, 0.82).setScale(artScale(this, 'toss-sprinkler', sds)).setDepth(sp.y);
    const dropScale = artScale(this, 'toss-drop', sds);
    this.spray = this.add.particles(sp.x, sp.y - 12 * sds, 'toss-drop', {
      speed: { min: 150 * sds, max: 215 * sds },
      angle: { onEmit: () => -90 + Math.sin(this.clock / 520) * 58 + Phaser.Math.Between(-6, 6) },
      gravityY: 380 * sds,
      lifespan: 900,
      scale: { start: dropScale, end: dropScale * 0.6 },
      alpha: { start: 0.95, end: 0.1 },
      frequency: 14,
      quantity: 2,
      emitting: false,
    });
    this.spray.setDepth(sp.y + 1);
    this.sprinklerOn = false;
    this.sprinklerNext = 6000;

    // The pet
    this.pet = { x: SIT.x, y: SIT.y, vx: 0, vy: 0, face: -1 };
    this.petShadow = this.add.image(SIT.x, SIT.y, 'shadow').setDepth(-3).setAlpha(0.85);
    this.petSprite = this.add.sprite(SIT.x, SIT.y, 'shadow');
    this.petMarks = [];
    this.applyPet();

    // Golden treats on the lawn, mostly far away, so long throws pay
    const pileKey = cat ? 'toss-pile-cat' : 'toss-pile';
    for (let i = 0; i < BONUS.piles; i++) {
      const pile: Pile = { x: 0, y: 0, img: this.add.image(0, 0, pileKey).setOrigin(0.5, 0.86), active: false, backAt: 0 };
      this.piles.push(pile);
      this.placePile(pile, false);
    }

    this.makeHud();
    this.setupInput();
    this.toReady();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => closeCards());
  }

  // ---------- Cards ----------

  private host(): CardHost {
    return {
      choice: () => this.choice,
      setChoice: (c) => {
        this.choice = c;
        savePet(c);
        this.applyPet();
      },
      petFrames: (c) => petFrameUrls(this, c, this.frameCache),
      progress: () => this.progress,
      play: (lvl) => {
        closeCards();
        this.progress.current = lvl;
        saveProgress(this.progress);
        savePet(this.choice);
        this.scene.start('game', { level: lvl, auto: true });
      },
      playBonus: (after) => {
        closeCards();
        this.scene.restart({ after });
      },
    };
  }

  private get name(): string {
    return displayName(loadHero(), this.choice.species);
  }

  // ---------- The pet ----------

  private applyPet(): void {
    this.look = petLookFor(this, this.choice);
    this.sizeF = SIZE_SCALE[this.choice.size];
    const sp = this.petSprite;
    sp.setTexture(this.look.idle).setOrigin(this.look.originX, 1).clearTint();
    if (this.look.tint !== undefined) sp.setTint(this.look.tint);
    this.petMarks.forEach((m) => m.destroy());
    this.petMarks = this.look.marks.map((k) => this.add.sprite(sp.x, sp.y, k.run, 0).setOrigin(this.look.originX, 1));
  }

  /** Where the pet wants to go: the thrown ball at first, then the finger, the mouse or the keys. */
  private petWish(): { x: number; y: number; speed: number } | undefined {
    const p = this.pet;
    const ds = depthScale(p.y);
    const toward = (t: Point, top: number) => {
      const dx = (t.x - p.x) / ds;
      const dy = (t.y - p.y) / (ds * BONUS.ySquash);
      const d = Math.hypot(dx, dy);
      if (d < 3) return { x: 0, y: 0, speed: 0 };
      return { x: dx / d, y: dy / d, speed: top * Math.min(1, d / ARRIVE) };
    };
    if (this.phase === 'over') return undefined;
    if (this.phase === 'ready') return toward(SIT, BONUS.petSpeed * 0.55);
    if (this.steer) return toward(this.steer, BONUS.petSpeed);
    const k = this.keys;
    const kx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    const ky = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    if (kx || ky) {
      this.autoUntil = 0;
      const d = Math.hypot(kx, ky);
      return { x: kx / d, y: ky / d, speed: BONUS.petSpeed };
    }
    const chase = this.autoBall;
    if (this.clock < this.autoUntil && chase?.state === 'free') return toward(chase, BONUS.petSpeed);
    return undefined;
  }

  private updatePet(dt: number): void {
    const p = this.pet;
    const wish = this.petWish();
    const wx = wish ? wish.x * wish.speed : 0;
    const wy = wish ? wish.y * wish.speed : 0;
    // speed up and turn smoothly: the velocity eases toward the wish
    let dvx = wx - p.vx;
    let dvy = wy - p.vy;
    const dv = Math.hypot(dvx, dvy);
    const most = BONUS.petAccel * dt;
    if (dv > most) {
      dvx *= most / dv;
      dvy *= most / dv;
    }
    p.vx += dvx;
    p.vy += dvy;
    slide(p, p.vx, p.vy, dt);
    // stay on the lawn
    if (p.y < BONUS.fieldTop) {
      p.y = BONUS.fieldTop;
      p.vy = Math.max(0, p.vy);
    } else if (p.y > BONUS.fieldBottom) {
      p.y = BONUS.fieldBottom;
      p.vy = Math.min(0, p.vy);
    }
    const hw = halfWidth(p.y, 30);
    if (p.x < CX - hw) {
      p.x = CX - hw;
      p.vx = Math.max(0, p.vx);
    } else if (p.x > CX + hw) {
      p.x = CX + hw;
      p.vx = Math.min(0, p.vx);
    }
    // face the way it runs sideways; running nearly straight up or down the lawn keeps the last facing
    if (Math.abs(p.vx) > 25 && Math.abs(p.vx) > 0.3 * Math.hypot(p.vx, p.vy)) p.face = Math.sign(p.vx);
    else if (this.phase === 'ready' && Math.hypot(p.vx, p.vy) < 20) p.face = -1; // sit facing the ball
  }

  private drawPet(dt: number): void {
    const p = this.pet;
    const sp = this.petSprite;
    const look = this.look;
    const ds = depthScale(p.y);
    const hopT = (this.clock - this.hopAt) / 380;
    const hop = hopT >= 0 && hopT < 1 ? Math.sin(hopT * Math.PI) * 26 * ds : 0;
    const speed = Math.hypot(p.vx, p.vy);
    const running = hop === 0 && speed > 25;
    // Feet move a little faster far away, so the small far-off pet doesn't look like it's gliding
    const far = 1 - (ds - BONUS.farScale) / (BONUS.nearScale - BONUS.farScale);
    const pace = Phaser.Math.Clamp(speed / BONUS.petSpeed, 0.45, 1.1) * (1 + 0.3 * Phaser.Math.Clamp(far, 0, 1));
    // A small bob and squash with each stride (until there are 3/4-view runs)
    if (running) this.stride += dt * Math.PI * 2 * 3.2 * pace;
    const step = running ? Math.abs(Math.sin(this.stride)) : 0;
    const bob = step * 2 * ds;
    const squash = running ? Math.abs(Math.cos(this.stride)) : 0;
    const base = look.scale * this.sizeF * PET_BASE * ds;
    // Flipped, the picture turns around its hit center (originX), so the body stays put
    const ox = p.face < 0 ? 1 - look.originX : look.originX;
    sp.setPosition(p.x, p.y - hop - bob)
      .setOrigin(ox, 1)
      .setScale(base * (1 + 0.035 * squash), base * (1 - 0.05 * squash))
      .setFlipX(p.face < 0)
      .setDepth(p.y);
    if (hop > 0) {
      sp.anims.stop();
      sp.setTexture(look.jump);
    } else if (running) {
      if (!sp.anims.isPlaying || sp.anims.currentAnim?.key !== look.anim) sp.play(look.anim);
      sp.anims.timeScale = pace;
    } else {
      if (sp.anims.isPlaying) sp.anims.stop();
      if (sp.texture.key !== look.idle) sp.setTexture(look.idle);
    }
    const lift = Math.max(0.5, 1 - hop / 60);
    this.petShadow
      .setPosition(p.x, p.y + 1)
      .setScale(artScale(this, 'shadow', 1.0 * this.sizeF * ds * lift))
      .setAlpha(0.8 * lift);
    this.petMarks.forEach((m, i) => {
      const k = look.marks[i];
      if (sp.texture.key === look.jump) m.setTexture(k.jump);
      else m.setTexture(k.run, sp.frame.name);
      m.setPosition(sp.x, sp.y).setOrigin(ox, 1).setScale(sp.scaleX, sp.scaleY).setFlipX(sp.flipX).setDepth(p.y + 0.01);
    });
  }

  /**
   * Where a carried ball's center goes: just behind and below the nose tip
   * of the picture showing now, on the side the pet faces.
   */
  private mouth(): Point {
    const sp = this.petSprite;
    const n = noseOf(this, sp.texture.key, sp.frame.name);
    const f = this.pet.face;
    const r = BALL_R * BALL_SIZE[this.choice.species] * depthScale(this.pet.y);
    return {
      x: sp.x + f * ((n.x - this.look.originX) * sp.displayWidth - r * 0.6),
      y: sp.y - (1 - n.y) * sp.displayHeight + r * 0.8,
    };
  }

  /** The spot on the ground under the pet's head, which is what reaches a ball or a treat. */
  private nose(): Point {
    const sp = this.petSprite;
    const n = noseOf(this, sp.texture.key, sp.frame.name);
    return { x: this.pet.x + this.pet.face * (n.x - this.look.originX) * sp.displayWidth * 0.8, y: this.pet.y };
  }

  // ---------- Balls ----------

  private ballCount(): number {
    const [two, three] = BONUS.multiAfter;
    return this.returned >= three ? 3 : this.returned >= two ? 2 : 1;
  }

  private makeBall(x: number, y: number): Ball {
    return {
      x, y, z: 0, vx: 0, vy: 0, vz: 0, bounces: 0, rolling: false, landed: false,
      state: 'tee',
      img: this.add.image(x, y, this.ballKey),
      shadow: this.add.image(x, y, 'toss-shadow').setDepth(-3),
      airCaught: false,
      thrownAt: 0,
      from: { x, y },
      trail: [],
    };
  }

  private toReady(): void {
    this.phase = 'ready';
    this.readyAt = 0;
    this.carrying = undefined;
    this.balls.forEach((b) => {
      b.img.destroy();
      b.shadow.destroy();
    });
    const n = this.ballCount();
    this.balls = Array.from({ length: n }, (_, i) => this.makeBall(TEE.x + (i - (n - 1) / 2) * 22, TEE.y));
    this.trailG.clear();
    const first = !this.started;
    this.hint('Swipe up to throw!', first ? this.throwHelp() : '');
    if (first) this.showFinger();
    if (n > 1 && !this.shown.has(`multi${n}`)) {
      this.shown.add(`multi${n}`);
      this.toast(n === 2 ? 'Two balls this time!' : 'Three balls!', '#c6f28a');
    }
  }

  private throwHelp(): string {
    const touch = this.sys.game.device.input.touch;
    return touch ? 'Longer, faster swipes throw farther' : 'Drag up with the mouse, or hold Space and aim with ← →';
  }

  private throwBalls(angle: number, power: number): void {
    if (this.phase !== 'ready' || this.paused) return;
    const tees = this.balls.filter((b) => b.state === 'tee');
    if (!tees.length) return;
    const spread = SPREAD[tees.length - 1];
    tees.forEach((b, i) => {
      const [turn, f] = spread[i];
      const v = launchSpeeds(Phaser.Math.Clamp(angle + turn, -MAX_AIM - 0.25, MAX_AIM + 0.25), Phaser.Math.Clamp(power * f, 0.06, 1));
      Object.assign(b, { ...v, z: LAUNCH_Z, bounces: 0, rolling: false, landed: false, state: 'free', thrownAt: this.clock, airCaught: false });
      b.from = { x: b.x, y: b.y };
      b.trail = [];
    });
    // The pet dashes after the main ball (its shadow) for a moment, then it's the player's to steer
    this.autoBall = tees[spread.findIndex(([, f]) => f === 1)] ?? tees[0];
    this.autoUntil = this.clock + BONUS.autoChaseMs;
    this.phase = 'fetch';
    this.started = true;
    this.keyAim = false;
    this.aimG.clear();
    this.hint('', '');
    this.finger?.destroy();
    this.finger = undefined;
    sfx.jump();
    if (!this.shown.has('steer')) {
      this.shown.add('steer');
      const touch = this.sys.game.device.input.touch;
      this.time.delayedCall(700, () => {
        if (this.phase === 'fetch' && !this.carrying) {
          this.toast(touch ? `Hold your finger where ${this.name} should run` : 'Steer with the arrow keys, or hold the mouse button', '#fff8e8', 2600);
        }
      });
    }
  }

  private updateBalls(dt: number): void {
    const cat = this.choice.species === 'cat';
    for (const b of this.balls) {
      if (b.state === 'tee') {
        b.z = Math.abs(Math.sin(this.clock / 230 + b.x * 0.1)) * 5; // little hops while it waits
      } else if (b.state === 'free') {
        this.sprinklerPush(b, dt);
        const sx = b.x;
        const sy = b.y - b.z * depthScale(b.y);
        stepBall(b, dt, this.kind);
        // roll the picture along the way it moves
        const ds = depthScale(b.y);
        const moved = Math.hypot(b.x - sx, b.y - b.z * ds - sy);
        const r = BALL_R * BALL_SIZE.dog * ds;
        if (moved > 0.05) b.img.rotation += (moved / r) * (b.vx >= 0 ? 1 : -1) * (b.rolling ? 1 : 0.4);
      } else if (b.state === 'mouth') {
        const m = this.mouth();
        const ds = depthScale(this.pet.y);
        b.x = m.x;
        b.y = this.pet.y;
        b.z = (this.pet.y - m.y) / ds;
      }
      // yarn leaves a thin trail that fades
      if (cat && (b.state === 'free' || b.state === 'mouth')) {
        const ds = depthScale(b.y);
        const at = { x: b.x, y: b.y - b.z * ds };
        const last = b.trail[b.trail.length - 1];
        if (!last || Math.hypot(at.x - last.x, at.y - last.y) > 3) b.trail.push({ ...at, t: this.clock });
      }
      while (b.trail.length && this.clock - b.trail[0].t > TRAIL_MS) b.trail.shift();
    }
  }

  private drawBalls(): void {
    const base = BALL_SIZE[this.choice.species];
    for (const b of this.balls) {
      const ds = depthScale(b.y);
      const inMouth = b.state === 'mouth';
      // Drawn up off the ground by its height; a little bigger up high, as if nearer the camera
      const high = inMouth ? 0 : Math.min(1, b.z / 260);
      const r = BALL_R * base * ds * (1 + 0.25 * high);
      b.img
        .setPosition(b.x, b.y - b.z * ds - (inMouth ? 0 : r))
        .setScale(artScale(this, this.ballKey, base * ds * (1 + 0.25 * high)))
        .setDepth(inMouth ? this.pet.y + 0.5 : b.y + 0.3);
      // The shadow stays on the ground: smaller and fainter the higher the ball is
      b.shadow
        .setVisible(!inMouth)
        .setPosition(b.x, b.y)
        .setScale(artScale(this, 'toss-shadow', 0.85 * ds * (1 - 0.55 * high)))
        .setAlpha(1 - 0.55 * high);
    }
    // the yarn trails
    const g = this.trailG.clear();
    for (const b of this.balls) {
      const pts = b.trail;
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].t - pts[i - 1].t > 150) continue;
        const a = 1 - (this.clock - pts[i].t) / TRAIL_MS;
        if (a <= 0) continue;
        g.lineStyle(1.5 * depthScale(pts[i].y), YARN_COLOR, a * 0.85);
        g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
      }
    }
  }

  private checkGrabs(): void {
    if (this.phase !== 'fetch' || this.carrying) return;
    const n = this.nose();
    for (const b of this.balls) {
      if (b.state !== 'free' || this.clock - b.thrownAt < GRAB_GRACE_MS) continue;
      if (b.z > BONUS.grabHeight * this.sizeF) continue; // sails over its head
      if (groundDist(n.x, n.y, b.x, b.y) > BONUS.grabReach * this.sizeF) continue;
      this.grab(b);
      return;
    }
  }

  private grab(b: Ball): void {
    b.state = 'mouth';
    b.vx = b.vy = b.vz = 0;
    this.carrying = b;
    this.autoUntil = 0;
    if (!b.landed) {
      // Caught before it touched the ground
      b.airCaught = true;
      this.airCatches++;
      this.addTreats(BONUS.airCatch);
      this.hopAt = this.clock;
      const top = this.petSprite.y - this.petSprite.displayHeight;
      this.pop(this.pet.x, top - 16, `Air catch! +${BONUS.airCatch}`, '#ffb547', 24);
      sfx.ding();
    } else {
      sfx.crunch();
    }
    this.ringPulse.timeScale = 2.2;
    this.ring.setTint(0xfff1b0);
    if (!this.shown.has('return')) {
      this.shown.add('return');
      this.toast('Bring it back to the circle!', '#c6f28a', 2200);
    }
  }

  private checkReturn(): void {
    const b = this.carrying;
    if (!b || this.phase !== 'fetch') return;
    const p = this.pet;
    const inRing = ((p.x - RING.x) / RING.rx) ** 2 + ((p.y - RING.y) / RING.ry) ** 2 <= 1.25;
    if (!inRing) return;
    this.carrying = undefined;
    b.state = 'home';
    b.x = Phaser.Math.Clamp(p.x, RING.x - RING.rx * 0.6, RING.x + RING.rx * 0.6);
    b.y = RING.y + 2;
    b.z = 0;
    b.trail = [];
    this.returned++;
    this.addTreats(BONUS.perReturn);
    this.pop(RING.x, RING.y - 46, `+${BONUS.perReturn}`, '#ffd23f', 26);
    if (this.choice.species === 'cat') sfx.meow();
    else sfx.bark(1);
    // A streak: this many returns in a row that were all caught in the air
    this.streakRun = b.airCaught ? this.streakRun + 1 : 0;
    if (this.streakRun >= BONUS.streak.length) {
      this.streakRun = 0;
      this.streaks++;
      this.addTreats(BONUS.streak.bonus);
      this.toast(`Streak! ${BONUS.streak.length} catches in a row +${BONUS.streak.bonus}`, '#ffb547');
      sfx.cheer();
    }
    this.ringPulse.timeScale = 1;
    this.ring.clearTint();
    if (this.balls.every((x) => x.state === 'home')) this.readyAt = this.clock + 450;
  }

  // ---------- Golden treats ----------

  /** A free spot for a pile: mostly in the far half, off the circle, the sprinkler and the other piles. */
  private placePile(pile: Pile, animate: boolean): void {
    let x = CX;
    let y = FIELD_MID;
    for (let tries = 0; tries < 40; tries++) {
      const far = Math.random() < BONUS.farShare;
      y = far ? Phaser.Math.FloatBetween(BONUS.fieldTop + 16, FIELD_MID) : Phaser.Math.FloatBetween(FIELD_MID, RING.y - 50);
      const hw = halfWidth(y, 44);
      x = CX + Phaser.Math.FloatBetween(-hw, hw);
      if (groundDist(x, y, RING.x, RING.y) < 140) continue;
      if (groundDist(x, y, BONUS.sprinkler.x, BONUS.sprinkler.y) < 60) continue;
      if (this.pet && groundDist(x, y, this.pet.x, this.pet.y) < 80) continue;
      if (this.piles.some((o) => o !== pile && o.active && groundDist(x, y, o.x, o.y) < 90)) continue;
      break;
    }
    const ds = depthScale(y);
    const s = artScale(this, pile.img.texture.key, ds);
    Object.assign(pile, { x, y, active: true });
    pile.img.setPosition(x, y).setDepth(y).setVisible(true).setAlpha(1);
    if (animate) {
      pile.img.setScale(0);
      this.tweens.add({ targets: pile.img, scale: s, duration: 260, ease: 'Back.easeOut' });
    } else {
      pile.img.setScale(s);
    }
  }

  private checkPiles(): void {
    if (this.phase === 'over') return;
    const n = this.nose();
    for (const pile of this.piles) {
      if (!pile.active) {
        if (this.clock >= pile.backAt) this.placePile(pile, true);
        continue;
      }
      if (groundDist(n.x, n.y, pile.x, pile.y) > PILE_REACH * this.sizeF) continue;
      pile.active = false;
      pile.backAt = this.clock + PILE_BACK_MS;
      this.golden += PILE_TREATS;
      this.addTreats(PILE_TREATS);
      this.pop(pile.x, pile.y - 30 * depthScale(pile.y), `+${PILE_TREATS}`, '#ffd23f', 22);
      sfx.crunch();
      this.tweens.add({ targets: pile.img, y: pile.y - 24 * depthScale(pile.y), alpha: 0, duration: 260, onComplete: () => pile.img.setVisible(false) });
    }
  }

  // ---------- The sprinkler ----------

  private updateSprinkler(): void {
    if (this.phase === 'over' || !this.started) {
      if (this.sprinklerOn) this.setSprinkler(false);
      return;
    }
    if (this.clock < this.sprinklerNext) return;
    this.setSprinkler(!this.sprinklerOn);
    const s = BONUS.sprinkler;
    this.sprinklerNext = this.clock + (this.sprinklerOn ? s.onMs : Phaser.Math.Between(s.offMs[0], s.offMs[1]));
  }

  private setSprinkler(on: boolean): void {
    this.sprinklerOn = on;
    if (on) this.spray.start();
    else this.spray.stop();
    this.tweens.add({ targets: this.sprinkler, scaleY: this.sprinkler.scaleX * (on ? 1.12 : 1), duration: 160, yoyo: on, ease: 'Sine.easeOut' });
  }

  /** While it's on, the spray pushes a ball that's low and close away from it. */
  private sprinklerPush(b: Ball, dt: number): void {
    if (!this.sprinklerOn) return;
    const s = BONUS.sprinkler;
    if (b.z > 80) return;
    const ds = depthScale((b.y + s.y) / 2);
    const dx = (b.x - s.x) / ds;
    const dy = (b.y - s.y) / (ds * BONUS.ySquash);
    const d = Math.hypot(dx, dy);
    if (d > s.reach) return;
    const f = (s.push * (1 - d / s.reach) * dt) / Math.max(d, 1);
    b.vx += dx * f;
    b.vy += dy * f;
  }

  // ---------- Input ----------

  private setupInput(): void {
    const kb = this.input.keyboard;
    this.keys = kb!.addKeys('LEFT,RIGHT,UP,DOWN,W,A,S,D', false) as BonusScene['keys'];
    kb?.on('keydown', () => sfx.unlock());
    kb?.on('keydown-SPACE', (e: KeyboardEvent) => {
      if (cardsOpen() || e.repeat) return;
      if (this.paused) this.resume();
      else if (this.phase === 'ready') {
        this.charging = true;
        this.charge = 0;
        this.keyAim = true;
      }
    });
    kb?.on('keyup-SPACE', () => {
      if (!this.charging) return;
      this.charging = false;
      if (this.phase === 'ready' && !this.paused && !cardsOpen()) this.throwBalls(this.aimAngle, 0.08 + 0.92 * this.charge);
    });
    kb?.on('keydown-P', () => !cardsOpen() && this.togglePause());
    kb?.on('keydown-ESC', () => !cardsOpen() && this.togglePause());

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.on('pointerupoutside', (p: Phaser.Input.Pointer) => this.onUp(p));

    // Pause by itself when the phone rings, the tab is hidden or the window loses focus
    const autoPause = () => {
      if (document.hidden || !document.hasFocus()) this.pause();
    };
    document.addEventListener('visibilitychange', autoPause);
    window.addEventListener('blur', autoPause);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', autoPause);
      window.removeEventListener('blur', autoPause);
    });
  }

  private at(p: Phaser.Input.Pointer): Point {
    const w = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: w.x, y: w.y };
  }

  private onDown(p: Phaser.Input.Pointer): void {
    sfx.unlock();
    if (this.uiTap) {
      this.uiTap = false;
      return;
    }
    if (cardsOpen() || this.phase === 'over') return;
    if (this.paused) {
      this.resume();
      return;
    }
    const w = this.at(p);
    if (this.phase === 'ready') {
      if (w.y < GAME_HEIGHT * 0.45) {
        this.nudgeHint();
        return;
      }
      this.drag = { id: p.id, x0: w.x, y0: w.y, x: w.x, y: w.y, samples: [{ ...w, t: performance.now() }] };
      this.keyAim = false;
      return;
    }
    this.steer = { id: p.id, ...w };
    this.autoUntil = 0; // the player takes over
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (this.paused) return;
    const w = this.at(p);
    const d = this.drag;
    if (d && d.id === p.id) {
      d.x = w.x;
      d.y = w.y;
      const now = performance.now();
      d.samples.push({ ...w, t: now });
      while (d.samples.length > 2 && now - d.samples[0].t > 100) d.samples.shift();
    }
    if (this.steer && this.steer.id === p.id) Object.assign(this.steer, w);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (d && d.id === p.id) {
      this.drag = undefined;
      const w = this.at(p);
      d.x = w.x;
      d.y = w.y;
      const now = performance.now();
      d.samples.push({ ...w, t: now });
      d.samples = d.samples.filter((s) => now - s.t <= 100);
      const aim = this.dragAim(d);
      this.aimG.clear();
      if (aim) this.throwBalls(aim.angle, aim.power);
      else if (this.phase === 'ready') this.nudgeHint();
    }
    if (this.steer && this.steer.id === p.id) this.steer = undefined;
  }

  /** A drag's aim and power: its direction sets the aim, its length and speed at the end set how far. */
  private dragAim(d: NonNullable<BonusScene['drag']>): { angle: number; power: number } | undefined {
    const dx = d.x - d.x0;
    const dy = d.y - d.y0;
    const len = Math.hypot(dx, dy);
    if (len < SWIPE_MIN || dy > -SWIPE_MIN * 0.6) return undefined; // it has to go up
    // the swipe's direction on screen, as a direction on the ground (up the screen is shorter)
    const angle = Phaser.Math.Clamp(Math.atan2(dx, -dy / BONUS.ySquash), -MAX_AIM, MAX_AIM);
    const s = d.samples;
    const first = s[0];
    const last = s[s.length - 1];
    const flick = s.length > 1 ? (Math.hypot(last.x - first.x, last.y - first.y) / Math.max(16, last.t - first.t)) * 1000 : 0;
    const lenN = Phaser.Math.Clamp((len - SWIPE_MIN) / 170, 0, 1);
    const speedN = Phaser.Math.Clamp((flick - 150) / 1100, 0, 1);
    return { angle, power: Phaser.Math.Clamp(0.72 * lenN + 0.45 * speedN, 0.1, 1) };
  }

  /** The dotted arc of the throw being aimed, from the drag or from the keys. */
  private drawAim(dt: number): void {
    if (this.phase !== 'ready') return;
    let aim: { angle: number; power: number } | undefined;
    if (this.drag) {
      const d = this.drag;
      const now = performance.now();
      const live = { ...d, samples: d.samples.filter((s) => now - s.t <= 100) };
      if (!live.samples.length) live.samples = [d.samples[d.samples.length - 1]];
      aim = this.dragAim(live);
    } else {
      const k = this.keys;
      const turn = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
      if (turn) this.keyAim = true;
      this.aimAngle = Phaser.Math.Clamp(this.aimAngle + turn * 1.3 * dt, -MAX_AIM, MAX_AIM);
      if (this.charging) this.charge = Math.min(1, this.charge + dt / 1.1);
      if (this.keyAim) aim = { angle: this.aimAngle, power: 0.08 + 0.92 * (this.charging ? this.charge : 0.5) };
    }
    const g = this.aimG.clear();
    // the hint steps aside while a throw is being aimed
    const aiming = Boolean(this.drag || this.keyAim);
    this.hintText.setAlpha(aiming ? 0.25 : 1);
    this.subText.setAlpha(aiming ? 0.25 : 1);
    this.subPill.setAlpha(aiming ? 0.25 : 1);
    this.finger?.setVisible(!aiming);
    if (!aim) return;
    const tees = this.balls.filter((b) => b.state === 'tee');
    const spread = SPREAD[Math.max(0, tees.length - 1)];
    tees.forEach((b, i) => {
      const [turn, f] = spread[i];
      const v = launchSpeeds(Phaser.Math.Clamp(aim.angle + turn, -MAX_AIM - 0.25, MAX_AIM + 0.25), Phaser.Math.Clamp(aim.power * f, 0.06, 1));
      const fl: Flight = { x: b.x, y: b.y, z: LAUNCH_Z, ...v, bounces: 0, rolling: false, landed: false };
      const main = f === 1;
      for (let step = 0; step < 400 && !fl.landed; step++) {
        stepBall(fl, 1 / 60, this.kind);
        if (step % 4 === 3 && !fl.landed) {
          const ds = depthScale(fl.y);
          g.fillStyle(0x16202a, main ? 0.35 : 0.2).fillCircle(fl.x, fl.y - fl.z * ds + 1, 3.2 * ds);
          g.fillStyle(0xffffff, main ? 0.95 : 0.55).fillCircle(fl.x, fl.y - fl.z * ds, 2.6 * ds);
        }
      }
      const ds = depthScale(fl.y);
      g.lineStyle(2 * ds, 0xffffff, main ? 0.9 : 0.5).strokeEllipse(fl.x, fl.y, 26 * ds, 10 * ds);
    });
    if (this.charging) {
      // how hard: a little bar under the circle
      g.fillStyle(0x16202a, 0.35).fillRoundedRect(RING.x - 50, RING.y + 30, 100, 8, 4);
      g.fillStyle(0xf5c542, 1).fillRoundedRect(RING.x - 50, RING.y + 30, Math.max(8, 100 * this.charge), 8, 4);
    }
  }

  // ---------- Pause ----------

  private togglePause(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  private pause(): void {
    if (this.paused || this.phase === 'over' || cardsOpen()) return;
    this.paused = true;
    this.drag = undefined;
    this.steer = undefined;
    this.charging = false;
    this.tweens.pauseAll();
    this.spray.pause();
    this.petSprite.anims.pause();
    this.time.paused = true;
    this.pauseText.setVisible(true);
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.tweens.resumeAll();
    this.spray.resume();
    this.petSprite.anims.resume();
    this.time.paused = false;
    this.pauseText.setVisible(false);
  }

  // ---------- HUD ----------

  private makeHud(): void {
    const big = { ...FONT, fontStyle: 'bold', color: '#1d2b1f' };
    const glow = 'rgba(255,255,255,0.65)';
    this.timerText = this.add.text(CX, 8, '1:00', { ...big, fontSize: '32px' }).setOrigin(0.5, 0).setDepth(HUD).setShadow(0, 2, glow, 0);
    this.treatText = this.add.text(64, 14, '', { ...big, fontSize: '24px' }).setDepth(HUD).setShadow(0, 2, glow, 0);
    this.ballText = this.add.text(GAME_WIDTH - 64, 14, '', { ...big, fontSize: '24px' }).setOrigin(1, 0).setDepth(HUD).setShadow(0, 2, glow, 0);
    // Hints: light letters with a heavy dark outline, so they read on the grass
    const hintStyle = { ...FONT, fontStyle: 'bold', color: '#fff8e8', stroke: INK, strokeThickness: 7, align: 'center' };
    this.hintText = this.add
      .text(CX, 232, '', { ...hintStyle, fontSize: '34px' })
      .setOrigin(0.5)
      .setDepth(HUD)
      .setShadow(0, 3, 'rgba(0,0,0,0.3)', 0, true, false);
    this.subPill = this.add.graphics().setDepth(HUD - 1);
    this.subText = this.add
      .text(CX, 276, '', { ...FONT, fontSize: '18px', fontStyle: 'bold', color: '#ffffff', align: 'center' })
      .setOrigin(0.5)
      .setDepth(HUD);
    this.toastText = this.add
      .text(CX, 78, '', { ...hintStyle, fontSize: '24px', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(HUD)
      .setAlpha(0);
    this.pauseText = this.add
      .text(CX, 250, 'Paused\nTap to go on', { ...hintStyle, fontSize: '36px' })
      .setOrigin(0.5)
      .setDepth(HUD + 1)
      .setVisible(false);
    const button = (x: number, label: string, onTap: (b: Phaser.GameObjects.Text) => void) => {
      const b = this.add.text(x, 30, label, { ...FONT, fontSize: '26px' }).setOrigin(0.5).setDepth(HUD).setInteractive({ useHandCursor: true });
      b.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.uiTap = true;
        sfx.unlock();
        onTap(b);
      });
      return b;
    };
    button(30, '⏸️', () => this.togglePause());
    button(GAME_WIDTH - 30, sfx.isMuted() ? '\u{1F507}' : '\u{1F50A}', (b) => {
      sfx.setMuted(!sfx.isMuted());
      b.setText(sfx.isMuted() ? '\u{1F507}' : '\u{1F50A}');
    });
    this.updateHud();
  }

  private updateHud(): void {
    const secs = Math.ceil(this.timeLeft / 1000);
    this.timerText.setText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    this.timerText.setColor(this.started && secs <= 10 ? '#c0392b' : '#1d2b1f');
    const cat = this.choice.species === 'cat';
    this.treatText.setText(`${cat ? '\u{1F41F}' : '\u{1F9B4}'} ${this.total}`);
    this.ballText.setText(`${cat ? '\u{1F9F6}' : '\u{1F3BE}'} ${this.returned}`);
  }

  private addTreats(n: number): void {
    this.total += n;
    this.updateHud();
    this.tweens.add({ targets: this.treatText, scale: 1.2, duration: 110, yoyo: true });
  }

  private hint(text: string, sub: string): void {
    this.hintText.setText(text);
    this.setSub(sub);
  }

  /** The smaller hint line, on a see-through dark pill. */
  private setSub(text: string): void {
    this.subText.setText(text);
    const g = this.subPill.clear();
    if (!text) return;
    const w = this.subText.displayWidth + 26;
    const h = this.subText.displayHeight + 10;
    g.fillStyle(0x16202a, 0.6).fillRoundedRect(CX - w / 2, this.subText.y - h / 2, w, h, h / 2);
  }

  private nudgeHint(): void {
    if (!this.hintText.text) return;
    this.setSub(this.sys.game.device.input.touch ? 'Start your swipe low on the screen' : this.throwHelp());
    this.tweens.add({ targets: [this.hintText, this.subText], scale: 1.08, duration: 120, yoyo: true });
  }

  /** A finger that shows the swipe, until the first throw. */
  private showFinger(): void {
    this.finger?.destroy();
    const f = this.add.text(TEE.x - 60, 500, '\u{1F446}', { ...FONT, fontSize: '40px' }).setOrigin(0.5).setDepth(HUD - 1).setAlpha(0);
    this.finger = f;
    this.tweens.add({
      targets: f,
      props: { y: { from: 505, to: 370 }, alpha: { from: 0.95, to: 0 } },
      duration: 1000,
      delay: 300,
      repeatDelay: 700,
      repeat: -1,
      ease: 'Cubic.easeOut',
    });
  }

  private toast(text: string, color: string, ms = 1600): void {
    this.toastText.setText(text).setColor(color).setAlpha(1).setScale(0.8);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, scale: 1, duration: 180, ease: 'Back.easeOut' });
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: ms, duration: 400 });
  }

  private pop(x: number, y: number, text: string, color: string, size: number): void {
    const t = this.add
      .text(x, y, text, { ...FONT, fontSize: `${size}px`, fontStyle: 'bold', color, stroke: INK, strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(HUD - 5);
    this.tweens.add({ targets: t, y: y - 36, alpha: 0, delay: 350, duration: 700, onComplete: () => t.destroy() });
  }

  // ---------- The round ----------

  update(_t: number, delta: number): void {
    if (this.paused || cardsOpen()) return;
    const dt = Math.min(delta, 50) / 1000;
    this.clock += dt * 1000;
    if (this.started && this.phase !== 'over') {
      const before = Math.ceil(this.timeLeft / 1000);
      this.timeLeft = Math.max(0, this.timeLeft - dt * 1000);
      const now = Math.ceil(this.timeLeft / 1000);
      if (now !== before) {
        this.updateHud();
        if (now <= 3 && now > 0) sfx.ding();
      }
      if (this.timeLeft <= 0) this.endRound();
    }
    if (this.phase === 'fetch' && this.readyAt && this.clock >= this.readyAt) this.toReady();
    this.drawAim(dt);
    this.updatePet(dt);
    this.updateBalls(dt);
    this.checkGrabs();
    this.checkReturn();
    this.checkPiles();
    this.updateSprinkler();
    this.drawPet(dt);
    this.drawBalls();
  }

  private endRound(): void {
    if (this.phase === 'over') return;
    this.phase = 'over';
    this.drag = undefined;
    this.steer = undefined;
    this.charging = false;
    this.aimG.clear();
    this.updateHud();
    // The round's treats go in the treat jar for good
    this.progress = loadProgress();
    this.progress.bonusTreats += this.total;
    saveProgress(this.progress);
    sfx.whistle();
    this.hint("Time's up!", '');
    this.time.delayedCall(1300, () => {
      if (!this.sys.isActive()) return;
      openBonusEnd(this.host(), {
        after: this.after,
        name: cap(this.name),
        species: this.choice.species,
        returned: this.returned,
        airCatches: this.airCatches,
        golden: this.golden,
        streaks: this.streaks,
        total: this.total,
        jar: this.progress.bonusTreats,
      });
    });
  }
}
