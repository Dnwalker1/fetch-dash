import Phaser from 'phaser';
import { artBox } from '../art/artFiles';
import { artScale, resOf } from '../art/paint';
import * as sfx from '../audio/sfx';
import { GAME_HEIGHT, GAME_WIDTH, HORIZON } from '../config';
import type { LevelDef, ObstacleKind } from '../levels';

/**
 * A run into the screen: the trail turns and heads for a vanishing point on
 * the horizon. The pet runs in one of three lanes (swipe or arrow left and
 * right), and tap still jumps. Things start as dots on the horizon and grow
 * as they come closer.
 *
 * It's drawn over the side-on trail (which is left as it is underneath) and
 * owns everything on screen except the HUD and the pet, which it borrows
 * from the game and gives back when the stretch ends.
 *
 * Distances ahead of the pet (z) are trail px, the same as the side-on run,
 * so the distance and the treats carry on in step. A thing z px ahead is
 * drawn at scale focal / (focal + z).
 */

type Img = Phaser.GameObjects.Image;

/** Draw order: everything in a run into the screen sits between these depths (the HUD is at 10). */
const DEPTH_BACK = 4;
const DEPTH_FAR = 4.1;
const DEPTH_NEAR = 4.9;
/** The pet is drawn bigger than on the side-on trail: it's close to the camera. */
const NEAR_SCALE = 1.3;
/** Lanes are -1, 0 and 1. */
const LANES = [-1, 0, 1];
/** Obstacles are this tall (px at full size, at the pet's distance) as far as jumping over them goes. */
const CLEAR_H = 0.75;

export interface HorizonHost {
  scene: Phaser.Scene;
  level: LevelDef;
  petSprite: Phaser.GameObjects.Sprite;
  petShadow: Img;
  /** The pet's scale on the side-on trail (look scale x size). */
  petScale: number;
  jumpTexture: string;
  runAnim: string;
  treatKey: string;
  /** Cats are quicker side to side and jump higher. */
  tune: { laneMs: number; jump: number };
  onTreatSpawned(n: number): void;
  onTreat(x: number, y: number, golden: boolean): void;
  onBump(): void;
  hint(key: string, text: string): void;
}

interface Thing {
  img: Img;
  z: number;
  /** Where across the trail: a lane (-1, 0, 1) or, for scenery, a farther offset. */
  lane: number;
  kind: 'obstacle' | 'treat' | 'scenery';
  /** Height off the ground (treats in an arc), px at full size. */
  lift: number;
  /** For obstacles, how tall they are at full size. */
  h: number;
  /** The picture's size at full scale. */
  base: number;
  shadow?: Img;
}

/** Scale at distance z ahead of the pet. */
export function depthAt(z: number): number {
  return HORIZON.focal / Math.max(1, HORIZON.focal + z);
}

export class HorizonRun {
  readonly lengthPx: number;
  private traveled = 0;
  private nextRowAt = 100;
  private nextSceneryAt = [0, 0];
  private things: Thing[] = [];
  private back: Phaser.GameObjects.GameObject[] = [];
  private road!: Phaser.GameObjects.Graphics;
  private lane = 0;
  private laneF = 0;
  private laneFrom = 0;
  private laneAt = -1e9;
  private airAt = -1e9;
  private clock = 0;
  private petDepth: number;
  private shadowDepth: number;
  private golden = false;

  constructor(
    private host: HorizonHost,
    lengthPx: number,
  ) {
    this.lengthPx = lengthPx;
    this.petDepth = host.petSprite.depth;
    this.shadowDepth = host.petShadow.depth;
    this.drawBack();
    // Fill the trail ahead with scenery so it doesn't start empty
    for (let z = HORIZON.spawnZ; z > -60; z -= 140) {
      for (const side of [-1, 1]) this.addScenery(side, z - Math.random() * 120);
    }
    this.nextSceneryAt = [120, 160];
    this.place();
  }

  get done(): boolean {
    return this.traveled >= this.lengthPx;
  }

  /** Swipe left or right: move a lane over. */
  steer(dir: number): void {
    const to = Phaser.Math.Clamp(this.lane + dir, -1, 1);
    if (to === this.lane) return;
    this.lane = to;
    this.laneFrom = this.laneF;
    this.laneAt = this.clock;
    sfx.slide();
  }

  /** Tap: jump, if not already in the air. */
  jump(): void {
    if (this.airborne) return;
    this.airAt = this.clock;
    sfx.jump();
  }

  private get airborne(): boolean {
    return this.clock - this.airAt < HORIZON.jumpMs;
  }

  /** How high the pet is (px at full size). */
  private get height(): number {
    const t = (this.clock - this.airAt) / HORIZON.jumpMs;
    if (t < 0 || t > 1) return 0;
    return Math.sin(t * Math.PI) * HORIZON.jumpHeight * this.host.tune.jump;
  }

  update(dt: number, speed: number): void {
    this.clock += dt * 1000;
    const dz = speed * dt;
    this.traveled += dz;
    // the lane change eases across
    const lt = Math.min(1, (this.clock - this.laneAt) / this.host.tune.laneMs);
    this.laneF = this.laneFrom + (this.lane - this.laneFrom) * Phaser.Math.Easing.Sine.Out(lt);

    for (const t of this.things) t.z -= dz;
    this.collide();
    this.things = this.things.filter((t) => {
      if (t.z > -HORIZON.focal * 0.12 && t.img.active) return true;
      t.img.destroy();
      t.shadow?.destroy();
      return false;
    });

    // New rows of obstacles and treats, until the last stretch, which stays clear
    const left = this.lengthPx - this.traveled;
    this.nextRowAt -= dz;
    if (this.nextRowAt <= 0 && left > HORIZON.spawnZ + 500) {
      this.spawnRow();
      const k = Math.max(1, speed / 300);
      this.nextRowAt = Phaser.Math.Between(HORIZON.gap[0], HORIZON.gap[1]) * k;
    } else if (!this.golden && left < HORIZON.spawnZ + 200) {
      this.golden = true;
      this.addTreat(this.lane, HORIZON.spawnZ, 20, true);
    }
    for (const i of [0, 1]) {
      this.nextSceneryAt[i] -= dz;
      if (this.nextSceneryAt[i] <= 0) {
        this.addScenery(i ? 1 : -1, HORIZON.spawnZ);
        this.nextSceneryAt[i] = Phaser.Math.Between(110, 260);
      }
    }
    this.drawRoad();
    this.place();
  }

  /** Puts the side-on trail's pet back and clears everything away. */
  destroy(): void {
    for (const t of this.things) {
      t.img.destroy();
      t.shadow?.destroy();
    }
    this.things = [];
    this.back.forEach((o) => o.destroy());
    this.back = [];
    const sp = this.host.petSprite;
    sp.setDepth(this.petDepth);
    this.host.petShadow.setDepth(this.shadowDepth);
  }

  // ---------- Drawing ----------

  private xAt(lane: number, z: number): number {
    const s = depthAt(z);
    return HORIZON.vanishX + (HORIZON.petX + lane * HORIZON.laneGap - HORIZON.vanishX) * s;
  }

  private yAt(z: number): number {
    return HORIZON.horizonY + (HORIZON.nearY - HORIZON.horizonY) * depthAt(z);
  }

  private depthOf(z: number): number {
    return DEPTH_FAR + (DEPTH_NEAR - DEPTH_FAR) * Phaser.Math.Clamp(1 - z / HORIZON.spawnZ, 0, 1.05);
  }

  /** Sky, faraway scenery on the horizon, and the land below it (drawn once). */
  private drawBack(): void {
    const sc = this.host.scene;
    const t = this.host.level.theme;
    const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => {
      this.back.push(o);
      return o;
    };
    const skyKey = `sky-${this.host.level.art}`;
    if (sc.textures.exists(skyKey)) {
      add(sc.add.image(0, 0, skyKey).setOrigin(0, 0).setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(DEPTH_BACK));
    } else {
      const g = add(sc.add.graphics().setDepth(DEPTH_BACK));
      g.fillGradientStyle(t.skyTop, t.skyTop, t.skyBottom, t.skyBottom, 1);
      g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
    // the level's farthest painted layer, sitting on the horizon
    const far = t.layers.find((l) => sc.textures.exists(l.key));
    if (far) {
      const src = sc.textures.get(far.key).getSourceImage() as HTMLImageElement;
      const scale = far.src ? (far.scale ?? 1) * 0.55 : artScale(sc, far.key, 0.55);
      // (painted strips have clear rows on top: skip them, as the side-on view does, so the strip's edge doesn't show)
      const h = (src.height - (far.src ? 4 : 0)) * scale;
      const tile = add(
        sc.add
          .tileSprite(0, HORIZON.horizonY + 6 - h, GAME_WIDTH, h, far.key)
          .setOrigin(0, 0)
          .setTileScale(scale)
          .setDepth(DEPTH_BACK + 0.01),
      );
      tile.tilePositionX = 300;
      if (far.src) tile.tilePositionY = 2;
      if (far.tint !== undefined) tile.setTint(far.tint);
    }
    // the land: lighter and hazier toward the horizon
    const g = add(sc.add.graphics().setDepth(DEPTH_BACK + 0.02));
    g.fillGradientStyle(Phaser.Display.Color.ValueToColor(t.haze).color, t.haze, t.grassDark, t.grassDark, 1);
    g.fillRect(0, HORIZON.horizonY, GAME_WIDTH, GAME_HEIGHT - HORIZON.horizonY);
    g.fillStyle(t.grass, 1);
    g.fillRect(0, HORIZON.horizonY + 14, GAME_WIDTH, GAME_HEIGHT - HORIZON.horizonY - 14);
    g.fillGradientStyle(t.haze, t.haze, t.grass, t.grass, 1, 1, 0, 0);
    g.fillRect(0, HORIZON.horizonY, GAME_WIDTH, 60);
    this.road = add(sc.add.graphics().setDepth(DEPTH_BACK + 0.03));
    this.drawRoad();
  }

  /** The trail running to the vanishing point, with mown stripes and lane marks sliding toward the camera. */
  private drawRoad(): void {
    const g = this.road;
    const t = this.host.level.theme;
    g.clear();
    const half = 1.75; // the trail's half width, in lanes
    const zNear = -70;
    const quad = (l0: number, l1: number, z0: number, z1: number, color: number, alpha: number) => {
      g.fillStyle(color, alpha);
      g.beginPath();
      g.moveTo(this.xAt(l0, z0), this.yAt(z0));
      g.lineTo(this.xAt(l1, z0), this.yAt(z0));
      g.lineTo(this.xAt(l1, z1), this.yAt(z1));
      g.lineTo(this.xAt(l0, z1), this.yAt(z1));
      g.closePath();
      g.fillPath();
    };
    // mown stripes across the grass
    const band = 160;
    const off = this.traveled % (band * 2);
    for (let z = -off - band * 2; z < HORIZON.spawnZ * 2; z += band * 2) {
      const z0 = Math.max(zNear, z);
      const z1 = z + band;
      if (z1 <= zNear) continue;
      quad(-12, 12, z0, z1, t.grassDark, 0.22 * Math.min(1, 1.6 - z / HORIZON.spawnZ / 1.4));
    }
    // the trail, its edges, and dashes between the lanes
    quad(-half, half, zNear, 40000, t.dirt, 1);
    quad(-half - 0.08, -half, zNear, 40000, t.dirtDark, 0.8);
    quad(half, half + 0.08, zNear, 40000, t.dirtDark, 0.8);
    const dash = 90;
    const doff = this.traveled % (dash * 2);
    for (let z = -doff; z < HORIZON.spawnZ * 1.6; z += dash * 2) {
      const z0 = Math.max(zNear, z);
      if (z + dash <= zNear) continue;
      for (const l of [-0.5, 0.5]) quad(l - 0.03, l + 0.03, z0, z + dash, t.dirtDark, 0.55);
    }
    // haze where the trail meets the sky
    g.fillGradientStyle(t.haze, t.haze, t.haze, t.haze, 0.85, 0.85, 0, 0);
    g.fillRect(0, HORIZON.horizonY - 1, GAME_WIDTH, 34);
  }

  /** Moves and sizes everything for its distance, and the pet for its lane and jump. */
  private place(): void {
    for (const t of this.things) {
      const s = depthAt(t.z);
      const x = this.xAt(t.lane, t.z);
      const y = this.yAt(t.z);
      t.img.setPosition(x, y - t.lift * s * NEAR_SCALE).setScale(t.base * s * NEAR_SCALE).setDepth(this.depthOf(t.z));
      // fade in from the haze
      t.img.setAlpha(Phaser.Math.Clamp((HORIZON.spawnZ - t.z) / 400, 0, 1));
      const sw = (t.shadow?.getData('w') as number | undefined) ?? 1;
      if (t.shadow) t.shadow.setPosition(x, y).setScale(sw * s * NEAR_SCALE, artScale(this.host.scene, 'shadow') * s * NEAR_SCALE).setDepth(this.depthOf(t.z) - 0.001).setAlpha(t.img.alpha * 0.8);
    }
    const sp = this.host.petSprite;
    const x = this.xAt(this.laneF, 0);
    const y = this.yAt(0);
    const h = this.height;
    sp.setPosition(x, y - h * NEAR_SCALE).setScale(this.host.petScale * NEAR_SCALE).setAngle(0).setFlipX(false).setDepth(this.depthOf(0));
    if (h > 0) {
      sp.anims.stop();
      sp.setTexture(this.host.jumpTexture);
    } else if (!sp.anims.isPlaying || sp.anims.currentAnim?.key !== this.host.runAnim) {
      sp.play(this.host.runAnim);
    }
    const ss = NEAR_SCALE * Math.max(0.4, 1 - h / 260);
    this.host.petShadow.setPosition(x, y + 2).setScale(ss, ss).setAlpha(Math.max(0.3, 1 - h / 300)).setDepth(this.depthOf(0) - 0.002);
  }

  // ---------- Things on the trail ----------

  private spawnRow(): void {
    const kinds = this.host.level.horizon!.obstacles;
    const z = HORIZON.spawnZ;
    // one obstacle, or two in different lanes, never all three
    const lanes = Phaser.Utils.Array.Shuffle([...LANES]);
    const n = Math.random() < 0.4 ? 2 : 1;
    const blocked = lanes.slice(0, n);
    for (const lane of blocked) this.addObstacle(Phaser.Utils.Array.GetRandom(kinds), lane, z);
    // treats: a line in an open lane, or an arc over an obstacle (jump for them)
    if (Math.random() < 0.75) {
      const over = Math.random() < 0.35;
      const lane = over ? blocked[0] : lanes[n];
      for (let i = 0; i < 4; i++) {
        const dz = (i - 1.5) * 55;
        const lift = over ? HORIZON.treatHeight + 30 + Math.cos((i - 1.5) * 0.7) * 70 : HORIZON.treatHeight;
        this.addTreat(lane, z + (over ? dz : 260 + i * 60), lift);
      }
    }
    this.host.hint('horizon-steer', this.touch ? 'Swipe left or right to change lanes!' : 'Press ← → to change lanes!');
  }

  private get touch(): boolean {
    return this.host.scene.sys.game.device.input.touch;
  }

  private addObstacle(kind: ObstacleKind, lane: number, z: number): void {
    const sc = this.host.scene;
    if (!sc.textures.exists(kind)) return;
    const box = artBox(sc, kind);
    const res = resOf(sc, kind);
    const img = sc.add.image(0, 0, kind);
    const src = img.frame;
    // stand the painted part on the ground
    img.setOrigin((box.x + box.w / 2) / src.width, (box.y + box.h) / src.height);
    const base = 1 / res;
    // the shadow texture is 64 px wide at its own resolution
    const shadow = sc.add.image(0, 0, 'shadow').setData('w', (box.w / res / 64) * 1.1 * artScale(sc, 'shadow') * 64 / 64);
    this.things.push({ img, z, lane, kind: 'obstacle', lift: 0, h: (box.h / res) * CLEAR_H, base, shadow });
  }

  private addTreat(lane: number, z: number, lift: number, golden = false): void {
    const sc = this.host.scene;
    const key = this.host.treatKey;
    const img = sc.add.image(0, 0, key);
    if (golden) {
      img.setTint(0xffd24a).setData('golden', true);
      sc.tweens.add({ targets: img, angle: { from: -10, to: 10 }, duration: 400, yoyo: true, repeat: -1 });
    } else {
      this.host.onTreatSpawned(1);
    }
    this.things.push({ img, z, lane, kind: 'treat', lift, h: 0, base: artScale(sc, key, golden ? 1.5 : 1.15) });
  }

  private addScenery(side: number, z: number): void {
    const sc = this.host.scene;
    const kinds = this.host.level.horizon!.scenery === 'sunflowers' ? ['hz-sunflower', 'hz-sunflower', 'hz-sunflower', 'hz-bush', 'hz-post'] : ['hz-bush', 'hz-flowers', 'hz-flowers', 'hz-tree', 'hz-post'];
    const key = Phaser.Utils.Array.GetRandom(kinds);
    if (!sc.textures.exists(key)) return;
    const img = sc.add.image(0, 0, key).setOrigin(0.5, 1);
    // posts line the trail's edge; the rest stand farther out
    const lane = side * (key === 'hz-post' ? 2.15 : 2.6 + Math.random() * (key === 'hz-tree' ? 4 : 2.5));
    this.things.push({ img, z, lane, kind: 'scenery', lift: 0, h: 0, base: artScale(sc, key, key === 'hz-tree' ? 1.4 : 1) });
  }

  /** Treats picked up and obstacles bumped, at the pet's distance. */
  private collide(): void {
    const h = this.height;
    for (const t of this.things) {
      if (t.kind === 'scenery' || !t.img.active || Math.abs(t.z) > HORIZON.hitZ) continue;
      if (Math.abs(t.lane - this.laneF) > 0.45) continue;
      if (t.kind === 'treat') {
        if (Math.abs(t.lift - h) > 60) continue;
        this.host.onTreat(t.img.x, t.img.y, !!t.img.getData('golden'));
        t.img.destroy();
      } else if (h < t.h && !t.img.getData('hit')) {
        t.img.setData('hit', true);
        this.host.onBump();
      }
    }
  }
}
