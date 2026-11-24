import Phaser from 'phaser';
import { makeTextures } from '../art/textures';
import { paintProps } from '../art/props';
import { paintCritters } from '../art/critters';
import { paintCritters2 } from '../art/critters2';
import { denFiles, paintDen, paintProps2 } from '../art/props2';
import { artScale, resized, resOf } from '../art/paint';
import { artBox, markArt, queueArt } from '../art/artFiles';
import { GROUND_COL, GROUND_TILE, GROUND_TOP, paintGround } from '../art/ground';
import { FG_H, FG_SPEED, paintForeground } from '../art/foreground';
import { LEDGE_H, ledgeTexture, pillarTexture } from '../art/ledges';
import { TUNNEL_CEILING, paintDigSpot, paintRoots, paintTunnel } from '../art/tunnel';
import { makeLevelArt } from '../art/levelArt';
import { makeLevelArt2 } from '../art/levelArt2';
import * as sfx from '../audio/sfx';
import { SIZE_SCALE, loadPet, makePetTextures, petKey, savePet, type PetChoice } from '../art/pets';
import { petFrameUrls, petLookFor, queuePetArt, type PetLook } from '../art/petLook';
import { BRAKE, CLIMB, DISTRACTION, TUNNEL, GAME_HEIGHT, GAME_WIDTH, GREET, GROUND_Y, PET, RENDER_SCALE, SCORE, SPAWN } from '../config';
import { groundYAt, levelById, loadProgress, saveProgress, LEVELS, TREAT_STAR_SHARE, type ChaserKind, type GawkKind, type LevelDef, type ObstacleKind, type Progress } from '../levels';
import { cardsOpen, closeCards, isUiEvent, openEnd, openHome, openSetup, refreshPetFrames, type CardHost } from '../ui/cards';
import { loadHero } from '../hero/store';
import { addDebugOverlay } from '../ui/debug';
import { setTutorialDone, tutorialDone } from '../tutorial';

type State = 'ready' | 'playing' | 'over';
type Rect = Phaser.GameObjects.Rectangle;
type Img = Phaser.GameObjects.Image;
type Body = Phaser.Physics.Arcade.Body;


/**
 * chase: something dashes past on the trail. The pet turns around and runs
 *        after it, and the run ends if it gets too far back.
 * gawk:  a bird in the sky or a critter in a den hole, out of reach.
 *        The pet stops to stare and slows down, but the run goes on.
 */
type DistractionKind = 'chase' | 'gawk';
interface Distraction {
  kind: DistractionKind;
  active: boolean; // false during the short warning, true once the pet gives in
}

/** A stone shelf in a climbing section. Its picture's left edge is at img.x; `top` is where the pet stands. */
interface Ledge {
  img: Img;
  pillars: Img[];
  w: number;
  top: number;
}

/** A neighbor on the sidewalk holding out a treat: stop next to them to get it. */
interface Greet {
  person: Phaser.GameObjects.Sprite;
  treat: Img;
  label: Phaser.GameObjects.Text;
  /** A glowing patch on the trail beside the neighbor: stop the pet on it */
  zone: Phaser.GameObjects.Ellipse;
  done: boolean;
}

/** The first-run tutorial on Level 1: what the player has to do at each stop. */
type TutorialMove = 'tap' | 'down' | 'up';
interface Tutorial {
  step: number; // 0 = jump the fence, 1 = slide under the branch, 2 = call the pet back
  want?: TutorialMove; // set while the game is held still, waiting for this move
  ui?: Phaser.GameObjects.Container;
  hand?: Phaser.GameObjects.Text;
  since: number;
}
/** The obstacles the tutorial uses, in order, and how far ahead (px) each one stops the game. */
const TUTORIAL_OBSTACLES: ObstacleKind[] = ['fence', 'branch'];
const TUTORIAL_STOP_PX = 95;

const SWIPE_PX = 30; // screen pixels
/** Obstacle hit areas as a share of the picture (see addObstacle). */
const HITBOX = { width: 0.72, height: 0.8 };
/** Dens sit on the hillside just behind the trail, a little smaller (farther away). */
/** A den's picture height in game px at a scale (its texture's height over its resolution). */
const DEN_H_OF = (img: Phaser.GameObjects.Image, scale: number): number => (img.displayHeight / scale);
/** The visible bottom of a den (its hole's front edge) sits this far behind (above) the trail line. */
const DEN_SINK = 3;
const DEN_SCALE = 1.1;
/** How much the painted scenery fades toward the trail, so things on the trail stand out. */
const TRAIL_HAZE = 0.28;
/** A jump pressed this soon before landing happens on landing. */
const JUMP_BUFFER_MS = 150;
/** A jump still works this soon after running off the top of a hill. */
const COYOTE_MS = 110;
/** Bumps a run can take: the first ones make the pet stumble, the last one ends the run. */
const PAWS = 3;
/** After a stumble, the pet can't be bumped again for this long. */
const STUMBLE_SAFE_MS = 1500;
const PET_COLOR = 0xa86b3c;

/** What dashes past on the trail, and the line on the end card if the pet runs off. */
const CHASERS: Record<ChaserKind, { label: string; texture: string; anim?: string; lift: number; hop: number; ranOff: string }> = {
  squirrel: { label: 'Squirrel', texture: 'squirrel', lift: 16, hop: 18, ranOff: 'Ran off after the squirrel!' },
  rabbit: { label: 'Bunny', texture: 'rabbit', lift: 18, hop: 26, ranOff: 'Ran off after the bunny!' },
  crab: { label: 'Crab', texture: 'crab', lift: 14, hop: 4, ranOff: 'Ran off after the crab!' },
  bird: { label: 'Bird', texture: 'bird-1', anim: 'bird-flap', lift: 14, hop: 20, ranOff: 'Ran off after the bird!' },
  cat: { label: 'Cat', texture: 'streetcat', lift: 16, hop: 14, ranOff: 'Ran off after the cat!' },
  dog: { label: 'Dog', texture: 'streetdog', lift: 19, hop: 10, ranOff: 'Ran away from the dog!' },
  frog: { label: 'Frog', texture: 'frog', lift: 13, hop: 30, ranOff: 'Ran off after the frog!' },
  fox: { label: 'Fox', texture: 'fox', lift: 17, hop: 16, ranOff: 'Ran off after the fox!' },
  cardinal: { label: 'Cardinal', texture: 'cardinal-1', anim: 'cardinal-flap', lift: 14, hop: 20, ranOff: 'Ran off after the cardinal!' },
  chipmunk: { label: 'Chipmunk', texture: 'chipmunk', lift: 13, hop: 14, ranOff: 'Ran off after the chipmunk!' },
  mouse: { label: 'Mouse', texture: 'mouse', lift: 9, hop: 6, ranOff: 'Ran off after the mouse!' },
  lizard: { label: 'Lizard', texture: 'lizard', lift: 9, hop: 3, ranOff: 'Ran off after the lizard!' },
  chicken: { label: 'Chicken', texture: 'chicken', lift: 18, hop: 20, ranOff: 'Ran off after the chicken!' },
  monkey: { label: 'Monkey', texture: 'monkey', lift: 19, hop: 32, ranOff: 'Ran off after the monkey!' },
  parrot: { label: 'Parrot', texture: 'parrot-1', anim: 'parrot-flap', lift: 20, hop: 22, ranOff: 'Ran off after the parrot!' },
  seagull: { label: 'Seagull', texture: 'gull-1', anim: 'gull-flap', lift: 16, hop: 22, ranOff: 'Ran off after the seagull!' },
};

/** Things that fly by out of reach. */
const FLYERS: Partial<Record<GawkKind, { texture: string; y: number; ms: number; msg: string }>> = {
  bird: { texture: 'bird', y: 230, ms: 4200, msg: 'Bird! Swipe up!' },
  gull: { texture: 'gull', y: 230, ms: 4200, msg: 'Seagull! Swipe up!' },
  pigeon: { texture: 'pigeon', y: 250, ms: 4600, msg: 'Pigeons! Swipe up!' },
  duck: { texture: 'duck', y: 220, ms: 4000, msg: 'Ducks! Swipe up!' },
  owl: { texture: 'owl', y: 200, ms: 5000, msg: 'An owl! Swipe up!' },
  crow: { texture: 'crow', y: 220, ms: 4200, msg: 'Crows! Swipe up!' },
  hawk: { texture: 'hawk', y: 170, ms: 4800, msg: 'A hawk! Swipe up!' },
  parrot: { texture: 'parrot', y: 210, ms: 4200, msg: 'A parrot! Swipe up!' },
  balloon: { texture: 'balloon', y: 230, ms: 6000, msg: 'A balloon! Swipe up!' },
};

/**
 * How each obstacle sits on the ground: its center's height above the
 * ground, and how to beat it. Things to slide under can come with a tree
 * (a trunk and a treetop) or with poles holding them up.
 */
type Decor = { tree: string } | { poles: number[]; tint: number; width: number; height: number; pole?: string };
/** Water lies flat on the trail: drawn a little below the ground line, with a thin hit band at the line. */
const FLAT_HIT_H = 10;
/**
 * `hit` overrides the share of the painted part that bumps the pet (HITBOX),
 * and `ground` marks a picture that brings its own patch of ground, so it
 * gets no shadow.
 */
type ObstacleDef = { lift: number; slide: boolean; decor?: Decor; flat?: boolean; hit?: { width: number; height: number }; ground?: boolean };
/**
 * The rooted trees that hold up the low branches (from trees.json). The tree
 * shares the obstacle's anchor (x, ground - lift); the obstacle picture is an
 * exact copy of the tree's limb there, so they line up with no seam. The trunk
 * stands about 100 px right of the anchor.
 */
const TREE_ORIGIN: Record<string, [number, number]> = {
  'tree-park': [0.2865, 0.6445],
  'tree-snow': [0.2933, 0.6667],
  'tree-autumn': [0.2681, 0.6893],
  'tree-blossom': [0.3025, 0.5848],
  'tree-jungle': [0.2821, 0.5955],
};
/** Trees spawn this much farther right, so the ground can level off under them off screen. */
const TREE_LEAD = 320;
/** The stretch of ground under a tree that's made level, from its anchor. */
const TREE_FLAT: [number, number] = [-70, 170];

/** The fences cross the trail at an angle, which leaves clear corners at the top: a smaller hit area. */
const FENCE: ObstacleDef = { lift: 34, slide: false, hit: { width: 0.55, height: 0.6 }, ground: true };
const OBSTACLES: Record<ObstacleKind, ObstacleDef> = {
  fence: FENCE,
  'fence-rail': FENCE,
  puddle: { lift: -7, slide: false, flat: true },
  log: { lift: 17, slide: false },
  rock: { lift: 19, slide: false },
  sandcastle: { lift: 26, slide: false },
  driftwood: { lift: 13, slide: false },
  branch: { lift: 65, slide: true, decor: { tree: 'tree-park' } },
  umbrella: { lift: 66, slide: true, decor: { poles: [0], tint: 0xffffff, width: 6, height: 90 } },
  trashcan: { lift: 23, slide: false },
  hydrant: { lift: 19, slide: false },
  sign: { lift: 22, slide: false },
  awning: { lift: 64, slide: true, decor: { poles: [-56, 56], tint: 0x2b2b3a, width: 4, height: 86 } },
  stump: { lift: 18, slide: false },
  creek: { lift: -8, slide: false, flat: true },
  snowman: { lift: 29, slide: false },
  sled: { lift: 13, slide: false },
  snowbranch: { lift: 65, slide: true, decor: { tree: 'tree-snow' } },
  haybale: { lift: 20, slide: false },
  pumpkin: { lift: 17, slide: false },
  autumnbranch: { lift: 65, slide: true, decor: { tree: 'tree-autumn' } },
  cactus: { lift: 26, slide: false },
  tumbleweed: { lift: 19, slide: false },
  arch: { lift: 64, slide: true, decor: { poles: [-55, 55], tint: 0xffffff, width: 20, height: 84, pole: 'arch-leg' } },
  trough: { lift: 13, slide: false },
  clothesline: { lift: 64, slide: true, decor: { poles: [-62, 62], tint: 0xffffff, width: 6, height: 90, pole: 'wood-post' } },
  lantern: { lift: 23, slide: false },
  pond: { lift: -8, slide: false, flat: true },
  blossombranch: { lift: 65, slide: true, decor: { tree: 'tree-blossom' } },
  vines: { lift: 68, slide: true, decor: { tree: 'tree-jungle' } },
  crate: { lift: 20, slide: false },
  barrel: { lift: 22, slide: false },
  banner: { lift: 63, slide: true, decor: { poles: [-62, 62], tint: 0xffffff, width: 5, height: 90, pole: 'pier-pole' } },
};

/**
 * The pet runs on its own. Tap to jump, swipe down to slide, swipe up to
 * call the pet back when something distracts it. Reach the ball at the end
 * of the trail to finish the level.
 */
export class GameScene extends Phaser.Scene {
  private state: State = 'ready';
  private level!: LevelDef;
  private progress!: Progress;
  private pet!: Rect;
  private petBody!: Body;
  private petSprite!: Phaser.GameObjects.Sprite;
  private petMarks: Phaser.GameObjects.Sprite[] = [];
  private look!: PetLook;
  private petDim = false;
  private petShadow!: Img;
  private choice!: PetChoice;
  private petW = PET.width;
  private petH = PET.height;
  private grounded = true;
  private lastJumpAt = -1000;
  private lastGroundedAt = 0;
  private jumpQueuedAt = -1000;
  private paws = PAWS;
  private safeUntil = 0;
  private pawIcons: Phaser.GameObjects.Text[] = [];
  private paused = false;
  private treatsSpawned = 0;
  private swipeArrow!: Phaser.GameObjects.Container;
  private pauseBtn?: Phaser.GameObjects.Text;
  private startedAt = 0;
  private uiTap = false; // set when a tap lands on a game button, so it doesn't also jump or start
  private heroBtn?: Phaser.GameObjects.Container;
  private wasOnGround = true;
  private dustTimer = 0;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private treats!: Phaser.Physics.Arcade.Group;
  private decor!: Phaser.Physics.Arcade.Group;
  private shownHints = new Set<string>();
  private groundBobs: Img[] = [];
  private popPool: Phaser.GameObjects.Text[] = [];
  private frameCache = new Map<string, string[]>();
  private darkSky = false;
  private weather: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  private baseSpeed = 300; // full running speed, rises over time
  private speedFactor = 1; // drops while the pet is distracted
  private distancePx = 0;
  private treatCount = 0;
  private bonus = 0;
  private best = 0;
  private nextSpawnIn = 0;
  private ballSpawned = false;

  private sliding = false;
  private slideLeftPx = 0;

  // Hold to stop: a finger held down (or the left arrow) puts the brakes on
  private braking = false;
  private brakeFactor = 1;
  private holdTimer?: Phaser.Time.TimerEvent;
  private greet?: Greet;
  private standing = false;
  private tut?: Tutorial;
  private obstacleQueue: ObstacleKind[] = [];

  // Climbing sections
  private ledges: Ledge[] = [];
  private onLedge?: Ledge;
  private prevBottom = 0;
  private nextClimbAt = Infinity;
  /** Stretches where the hills are eased to a level (GROUND_Y unless `y` is given) */
  private flats: { from: number; to: number; y?: number }[] = [];

  // Dig spots and tunnels
  private nextDigAt = Infinity;
  private digSpot?: { img: Img; label: Phaser.GameObjects.Text; done: boolean };
  private tunnel?: { endAt: number; strip: Phaser.GameObjects.TileSprite; golden: boolean };
  private fgLayer?: Phaser.GameObjects.TileSprite;
  private dens: Phaser.GameObjects.Container[] = [];
  private skyIsDark = false;

  private distraction?: Distraction;
  private returning = false;
  // A jump or slide pressed while the pet was turned around; done right after the call-back
  private pendingMove?: { kind: 'jump' | 'slide'; at: number };
  private downKey?: Phaser.Input.Keyboard.Key;
  private distractionTimer?: Phaser.Time.TimerEvent;
  private scheduleTimer?: Phaser.Time.TimerEvent;
  private alertText!: Phaser.GameObjects.Text;

  private scoreText!: Phaser.GameObjects.Text;
  private centerText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private progressFill!: Rect;
  private layers: { tile: Phaser.GameObjects.TileSprite; factor: number }[] = [];

  private pointerStart?: { x: number; y: number; handled: boolean };

  constructor() {
    super('game');
  }

  private get speed(): number {
    return this.baseSpeed * this.speedFactor * this.brakeFactor;
  }

  /** The painted pictures for the level about to start (each fetched only once). */
  preload(): void {
    const data = this.scene.settings.data as { level?: number } | undefined;
    const l = levelById(data?.level ?? loadProgress().current);
    const t = l.theme;
    if (t.skyImage && !this.textures.exists(`sky-${l.id}`)) this.load.image(`sky-${l.id}`, t.skyImage);
    for (const layer of t.layers) if (layer.src && !this.textures.exists(layer.key)) this.load.image(layer.key, layer.src);
    // the pet's painted sprites, if it has them
    queuePetArt(this, loadPet());
    // the painted props and critters this level uses (anything without a file is painted in code)
    // (the tunnels have stones in them)
    queueArt(this, [...propKeys([...(Object.keys(l.obstacles) as ObstacleKind[]), ...(l.dig ? (['rock'] as ObstacleKind[]) : [])]), ...critterKeys(l)]);
  }

  create(data?: { level?: number; auto?: boolean }): void {
    // The canvas is RENDER_SCALE times the world's size; zoom in so the world fills it
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.popPool = [];
    this.progress = loadProgress();
    this.level = levelById(data?.level ?? this.progress.current);
    this.progress.current = this.level.id;
    this.best = this.progress.best[this.level.id] ?? 0;
    this.state = 'ready';
    this.baseSpeed = this.level.speed.start;
    this.speedFactor = 1;
    this.distancePx = 0;
    this.treatCount = 0;
    this.treatsSpawned = 0;
    this.bonus = 0;
    this.nextSpawnIn = 600;
    this.ballSpawned = false;
    this.sliding = false;
    this.distraction = undefined;
    this.returning = false;
    this.grounded = true;
    this.layers = [];
    this.shownHints = new Set<string>();
    this.heroBtn = undefined;
    this.paws = PAWS;
    this.safeUntil = 0;
    this.paused = false;
    this.braking = false;
    this.brakeFactor = 1;
    this.holdTimer = undefined;
    this.greet = undefined;
    this.standing = false;
    this.tut = undefined;
    this.obstacleQueue = [];
    this.ledges = [];
    this.flats = [];
    this.onLedge = undefined;
    this.nextDigAt = this.level.dig ? this.level.dig.firstM * SCORE.pixelsPerMeter : Infinity;
    this.digSpot = undefined;
    this.tunnel = undefined;
    this.fgLayer = undefined;
    this.dens = [];
    this.nextClimbAt = this.level.climb ? this.level.climb.firstM * SCORE.pixelsPerMeter : Infinity;

    // Painted props go first; the flat-shape art fills in whatever they don't cover.
    // Props and critters with a picture file use it, and the code paints the rest.
    markArt(this);
    paintProps(this);
    paintProps2(this);
    paintCritters(this);
    paintCritters2(this);
    makeTextures(this);
    makeLevelArt(this);
    makeLevelArt2(this);
    this.makeAnimations();
    this.choice = loadPet();
    makePetTextures(this, this.choice);
    this.drawBackground();
    this.weather = [];
    this.startWeather();

    // The ground is a painted strip laid down in narrow columns, each moved
    // every frame to sit on the hill under it. (Images rather than a Blitter:
    // the strip is painted at the render scale, and a Blitter can't scale.)
    const groundKey = paintGround(this, this.level.id, this.level.theme);
    const groundScale = artScale(this, groundKey);
    this.groundBobs = [];
    for (let i = 0; i <= Math.ceil(GAME_WIDTH / GROUND_COL); i++) {
      this.groundBobs.push(this.add.image(0, 0, groundKey, 0).setOrigin(0, 0).setScale(groundScale).setDepth(0.9));
    }
    // Close-up grass (or shells, snow, the pier rail) sliding by in front, below the trail
    const fg = paintForeground(this, this.level.id, this.level.theme);
    if (fg) this.fgLayer = this.addLayer(fg, GAME_HEIGHT - FG_H, FG_H, FG_SPEED).setDepth(2.5).setTileScale(artScale(this, fg));

    // Pet: an invisible box does the physics, and the pet sprite is drawn on top of it
    const gy = this.groundAt(PET.homeX);
    this.pet = this.add.rectangle(PET.homeX, gy - PET.height / 2, PET.width, PET.height, PET_COLOR);
    this.pet.setVisible(false);
    this.physics.add.existing(this.pet);
    this.petBody = this.pet.body as Body;
    this.petBody.setCollideWorldBounds(false);
    this.petShadow = this.add.image(PET.homeX, gy, 'shadow').setDepth(1.9);
    this.petSprite = this.add.sprite(PET.homeX, gy, `${petKey(this.choice)}-run-0`).setOrigin(0.5, 1).setDepth(2);
    this.petMarks = [];
    this.petDim = false;
    this.applyPet();

    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.treats = this.physics.add.group({ allowGravity: false });
    this.decor = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.pet, this.obstacles, () => this.bump());
    this.physics.add.overlap(this.pet, this.treats, (_p, t) => this.collectTreat(t as Img));

    // HUD
    // Text is drawn on its own little canvas: give it the render scale so it stays sharp
    const font = { fontFamily: 'Arial, sans-serif', color: '#1d2b1f', resolution: RENDER_SCALE };
    const top = this.level.theme.skyTop;
    const dark = ((top >> 16) & 255) * 0.3 + ((top >> 8) & 255) * 0.59 + (top & 255) * 0.11 < 120;
    this.darkSky = dark;
    this.skyIsDark = dark;
    this.scoreText = this.add
      .text(20, 16, '', { ...font, fontSize: '24px', fontStyle: 'bold', color: dark ? '#fff8e8' : '#1d2b1f' })
      .setDepth(10)
      .setShadow(0, 2, dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.5)', 0);
    this.add.rectangle(GAME_WIDTH - 220, 30, 200, 14, 0xffffff, 0.7).setOrigin(0, 0.5).setDepth(10);
    this.progressFill = this.add.rectangle(GAME_WIDTH - 220, 30, 0, 14, 0x3f7d3a).setOrigin(0, 0.5).setDepth(10);
    this.add.circle(GAME_WIDTH - 14, 30, 10, 0xd8e65a).setStrokeStyle(2, 0x7a8a1a).setDepth(10);
    this.centerText = this.add
      .text(GAME_WIDTH / 2, 190, '', { ...font, fontSize: '30px', fontStyle: 'bold', align: 'center', color: dark ? '#fff8e8' : '#1d2b1f' })
      .setOrigin(0.5)
      .setDepth(10)
      .setShadow(0, 2, dark ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)', 0);
    this.toastText = this.add
      .text(GAME_WIDTH / 2, 110, '', { ...font, fontSize: '28px', fontStyle: 'bold', color: '#1f6f2a' })
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0)
      .setShadow(0, 2, 'rgba(255,255,255,0.7)', 0);
    this.alertText = this.add
      .text(0, 0, '!', { ...font, fontSize: '40px', fontStyle: 'bold', color: '#d6402b' })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);

    this.updateHud();
    this.drawGround();
    this.updatePetSprite();
    this.addMuteButton();
    this.addPauseAndPaws();
    this.swipeArrow = this.makeSwipeArrow();
    this.setupInput();
    addDebugOverlay(this, () => `speed ${this.speed.toFixed(0)} px/s  x${(this.speedFactor * this.brakeFactor).toFixed(2)} (distraction ${this.speedFactor.toFixed(2)}, brake ${this.brakeFactor.toFixed(2)})${this.braking ? ' BRAKING' : ''}${this.onLedge ? ' on-ledge' : ''}`);

    // First visit: make your hero. After that: meet your hero and pick a
    // level. Between runs: straight to "Tap to run".
    if (data?.auto) {
      this.showReady();
    } else {
      this.showReady();
      if (!loadHero()) openSetup(this.cardHost(), { canGoBack: false });
      else openHome(this.cardHost());
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => closeCards());
  }

  // ---------- Cards (start, home, end) ----------

  private cardHost(): CardHost {
    return {
      choice: () => this.choice,
      setChoice: (c) => {
        this.choice = c;
        savePet(c);
        this.applyPet();
        this.updatePetSprite();
        this.loadLook();
      },
      petFrames: (c) => petFrameUrls(this, c, this.frameCache),
      progress: () => this.progress,
      play: (lvl) => {
        closeCards();
        this.progress.current = lvl;
        saveProgress(this.progress);
        savePet(this.choice);
        if (lvl === this.level.id && this.state === 'ready') {
          this.startedAt = this.time.now;
          this.showReady();
        } else {
          this.scene.restart({ level: lvl, auto: true });
        }
      },
      playBonus: (after) => {
        closeCards();
        saveProgress(this.progress);
        savePet(this.choice);
        this.scene.start('bonus', { after });
      },
    };
  }

  // ---------- Input ----------

  private setupInput(): void {
    const keys = this.input.keyboard;
    keys?.on('keydown-SPACE', (e: KeyboardEvent) => {
      if (cardsOpen()) return;
      if (this.paused) this.resume();
      else if (this.state === 'ready') this.startRun();
      else this.withTime(e, () => this.onTap());
    });
    this.downKey = keys?.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN, false);
    keys?.on('keydown-DOWN', (e: KeyboardEvent) => {
      if (cardsOpen()) return;
      // Holding the key fires it over and over. Those repeats only keep a
      // slide going; they never start one or pull the pet out of a jump.
      if (e.repeat) this.holdSlide();
      else this.withTime(e, () => this.onSwipeDown());
    });
    keys?.on('keydown-UP', (e: KeyboardEvent) => !cardsOpen() && this.withTime(e, () => this.onSwipeUp()));
    // Hold the left arrow to stop (like a finger held down on a phone)
    keys?.on('keydown-LEFT', () => !cardsOpen() && this.setBrake(true));
    keys?.on('keyup-LEFT', () => this.setBrake(false));
    keys?.on('keydown', () => sfx.unlock());
    keys?.on('keydown-P', () => !cardsOpen() && this.togglePause());
    keys?.on('keydown-ESC', () => !cardsOpen() && this.togglePause());
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

    // Touch and mouse are read straight from the page, in screen pixels.
    // Listening on the whole window means a swipe works anywhere on the
    // screen (not only on the game canvas), and preventDefault stops the
    // browser or the app around the game from scrolling instead. Touches
    // on the cards are left alone so their buttons and fields work.
    const opts: AddEventListenerOptions = { passive: false };
    const down = (x: number, y: number) => {
      sfx.unlock();
      const start = { x, y, handled: false };
      this.pointerStart = start;
      // Held in place instead of tapped or swiped: put the brakes on until it lifts
      this.holdTimer?.remove();
      if (this.state === 'playing' && !this.paused) {
        this.holdTimer = this.time.delayedCall(BRAKE.holdMs, () => {
          if (this.pointerStart !== start || start.handled) return;
          start.handled = true;
          this.setBrake(true);
        });
      }
    };
    const move = (x: number, y: number) => {
      const s = this.pointerStart;
      if (!s || s.handled) return;
      const dy = y - s.y;
      if (Math.abs(dy) < SWIPE_PX || Math.abs(dy) < Math.abs(x - s.x)) return;
      s.handled = true;
      if (dy > 0) this.onSwipeDown();
      else this.onSwipeUp();
    };
    const up = () => {
      const s = this.pointerStart;
      this.pointerStart = undefined;
      this.holdTimer?.remove();
      this.setBrake(false);
      if (s && !s.handled) this.onTap();
    };

    const onTouchStart = (e: TouchEvent) => {
      if (isUiEvent(e)) return;
      e.preventDefault();
      const t = e.changedTouches[0];
      down(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isUiEvent(e)) return;
      e.preventDefault();
      const t = e.changedTouches[0];
      move(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (isUiEvent(e)) return;
      e.preventDefault();
      up();
    };
    const onMouseDown = (e: MouseEvent) => {
      if (!isUiEvent(e)) down(e.clientX, e.clientY);
    };
    const onMouseMove = (e: MouseEvent) => {
      if (e.buttons) move(e.clientX, e.clientY);
    };

    window.addEventListener('touchstart', onTouchStart, opts);
    window.addEventListener('touchmove', onTouchMove, opts);
    window.addEventListener('touchend', onTouchEnd, opts);
    window.addEventListener('touchcancel', onTouchEnd, opts);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', up);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', up);
    });
  }

  private get chasing(): boolean {
    return this.distraction?.kind === 'chase' && this.distraction.active;
  }

  private onTap(): void {
    if (this.uiTap) {
      this.uiTap = false;
      return;
    }
    if (cardsOpen()) return;
    if (this.paused) {
      this.resume();
      return;
    }
    if (this.state === 'ready') {
      this.startRun();
      return;
    }
    if (this.time.now - this.startedAt < 300) return; // the tap that pressed Start
    if (this.state === 'over') return;
    if (!this.tutorialMove('tap')) return;
    if (this.chasing) {
      // A pet running the wrong way doesn't listen yet, but remember the jump
      // so it happens the moment the pet is called back.
      this.pendingMove = { kind: 'jump', at: this.clock() };
      return;
    }
    const now = this.clock();
    if (this.grounded) this.jump();
    // Just ran off the top of a hill: still counts as on the ground
    else if (now - this.lastGroundedAt < COYOTE_MS && now - this.lastJumpAt > 250) this.jump();
    // Still in the air: remember it and jump on landing
    else this.jumpQueuedAt = now;
  }

  private jump(): void {
    this.stopSlide();
    this.grounded = false;
    this.lastJumpAt = this.clock();
    this.petBody.setVelocityY(PET.jumpVelocity);
    sfx.jump();
  }

  private onSwipeDown(): void {
    if (this.state !== 'playing' || this.paused) return;
    if (!this.tutorialMove('down')) return;
    if (this.chasing) {
      this.pendingMove = { kind: 'slide', at: this.clock() };
      return;
    }
    // Down pressed at almost the same moment as a jump: the jump wins
    if (!this.grounded && this.clock() - this.lastJumpAt < 200) return;
    if (!this.grounded) {
      // Fast-fall when in the air
      this.petBody.setVelocityY(900);
    }
    this.startSlide();
  }

  /**
   * When the press really happened. The game reads key presses once per
   * frame, so on a busy computer two presses a moment apart can be handled
   * further apart; the key event's own timestamp keeps them honest.
   */
  private eventTime?: number;
  private clock(): number {
    return this.eventTime ?? performance.now();
  }

  private withTime(e: KeyboardEvent, fn: () => void): void {
    this.eventTime = e.timeStamp || undefined;
    try {
      fn();
    } finally {
      this.eventTime = undefined;
    }
  }

  private holdSlide(): void {
    if (this.state === 'playing' && !this.paused && this.sliding && this.grounded && !this.chasing) this.slideLeftPx = PET.slideDistance;
  }

  private onSwipeUp(): void {
    if (this.state !== 'playing' || this.paused) return;
    if (!this.tutorialMove('up')) return;
    if (this.distraction) this.callBack();
  }

  /** Hold to stop: the pet skids to a stop while the finger (or left arrow) is held, and runs on when it lifts. */
  private setBrake(on: boolean): void {
    if (on && (this.state !== 'playing' || this.paused)) return;
    if (on === this.braking) return;
    this.braking = on;
    if (on) {
      this.stopSlide();
      if (this.grounded && !this.chasing) this.dust(4);
    }
  }

  // ---------- Run lifecycle ----------

  /** "Tap to run" with the level name, plus a small My hero button. */
  private showReady(): void {
    this.centerText.setFontSize(30);
    this.centerText.setText(`Level ${this.level.id}  ·  ${this.level.name}\n\nTap to run!`);
    if (this.heroBtn) return;
    const btn = this.add.container(GAME_WIDTH - 90, 70).setDepth(20);
    const bg = this.add
      .rectangle(0, 0, 150, 36, 0xfbf6ea, 0.95)
      .setStrokeStyle(2, 0xc79a3e)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => {
      this.uiTap = true;
      openHome(this.cardHost());
    });
    btn.add(bg);
    btn.add(
      this.add
        .text(0, 0, '\u{1F43E} My hero', { fontFamily: 'Arial, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#16202a', resolution: RENDER_SCALE })
        .setOrigin(0.5),
    );
    this.heroBtn = btn;
  }

  private startRun(): void {
    if (cardsOpen()) return;
    this.state = 'playing';
    this.startedAt = this.time.now;
    savePet(this.choice);
    saveProgress(this.progress);
    this.centerText.setText('');
    this.heroBtn?.destroy();
    this.heroBtn = undefined;
    this.pauseBtn?.setVisible(true);
    if (this.level.id === 1 && !tutorialDone()) {
      // First run: the game stops at a fence, a branch and a squirrel to show each move
      this.tut = { step: 0, since: 0 };
      this.obstacleQueue = [...TUTORIAL_OBSTACLES];
    } else {
      this.scheduleDistraction(DISTRACTION.firstAfterMs);
    }
  }

  private endRun(reason: string, won = false): void {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.braking = false;
    this.holdTimer?.remove();
    this.pauseBtn?.setVisible(false);
    this.tweens.killTweensOf(this.petSprite);
    this.petSprite.setAlpha(1);
    this.physics.pause();
    // Freeze what is moving now, but leave the tween manager running so the
    // finish effects (confetti) can still animate.
    this.tweens.getTweens().forEach((t) => t.pause());
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setAlpha(0);
    this.scheduleTimer?.remove();
    this.distractionTimer?.remove();
    this.alertText.setVisible(false);
    this.swipeArrow.setVisible(false);
    this.petSprite.anims.pause();
    if (!won) {
      this.petDim = true;
      this.petSprite.setTint(dim(this.look.tint ?? 0xffffff));
    }
    if (won) {
      sfx.cheer();
      this.petSound(3);
      this.confetti();
    } else if (reason.startsWith('Ran off')) {
      this.petSound(2);
    } else {
      sfx.bonk();
      this.cameras.main.shake(250, 0.012);
    }

    const score = this.score();
    const newBest = score > this.best;
    const id = this.level.id;
    if (newBest) {
      this.best = score;
      this.progress.best[id] = score;
    }
    const goals = {
      finish: won,
      treats: this.treatsSpawned > 0 && this.treatCount >= Math.ceil(this.treatsSpawned * TREAT_STAR_SHARE),
      clean: this.paws === PAWS,
    };
    const stars = won ? 1 + Number(goals.treats) + Number(goals.clean) : 0;
    this.progress.stars[id] = Math.max(this.progress.stars[id] ?? 0, stars);
    if (won) {
      if (!this.progress.done.includes(id)) this.progress.done.push(id);
      this.progress.unlocked = Math.max(this.progress.unlocked, Math.min(LEVELS.length, id + 1));
    }
    saveProgress(this.progress);
    this.updateHud();

    // Give the crash or the cheer a moment before the card slides in
    this.time.delayedCall(won ? 1100 : 650, () => {
      openEnd(this.cardHost(), {
        level: id,
        won,
        reason,
        score,
        best: this.best,
        newBest,
        meters: this.meters(),
        treats: this.treatCount,
        treatsTotal: this.treatsSpawned,
        goals,
        stars,
        bestStars: this.progress.stars[id] ?? 0,
      });
    });
  }

  // ---------- Main loop ----------

  update(_time: number, deltaMs: number): void {
    if (this.tut?.want && this.state === 'playing') {
      this.animateTutorial();
      return;
    }
    this.keepOnGround();
    if (this.sliding) this.reachTreatsWhileSliding();
    this.alertText.setPosition(this.pet.x, this.pet.y - 62);
    this.swipeArrow.setPosition(this.pet.x + 46, this.pet.y - 66);
    this.updatePetSprite();
    this.syncMarks();
    this.drawGround();
    if (this.state !== 'playing' || this.paused) return;
    const dt = deltaMs / 1000;

    // The brakes: down to a stop quickly, back up to speed a little slower
    const wantStop = this.braking && !this.chasing;
    // Stopped a little short of a neighbor with a treat: walk up to them
    const g = this.greet;
    const creep = wantStop && g && !g.done && g.person.x - this.pet.x > GREET.reach * 0.4 ? GREET.creepSpeed / Math.max(1, this.baseSpeed * this.speedFactor) : 0;
    this.brakeFactor = wantStop ? Math.max(creep, this.brakeFactor - dt / BRAKE.stopS) : Math.min(1, this.brakeFactor + dt / BRAKE.goS);

    const sp = this.level.speed;
    if (!this.braking) this.baseSpeed = Math.min(sp.max, this.baseSpeed + sp.gainPerSecond * dt);
    const dx = this.speed * dt;
    this.distancePx += dx;
    this.moveLedges(dx);
    this.moveDens(dx);
    this.updateGreet(dx);
    this.updateDig(dx);
    if (this.tut) this.checkTutorial();

    // Scroll the background layers; farther layers move slower. A layer's
    // factor is its share of the trail's speed on screen; tilePosition counts
    // texture pixels, so it's divided by the tile scale.
    for (const l of this.layers) l.tile.tilePositionX += (dx * l.factor) / l.tile.tileScaleX;

    // Keep moving things in step with the current speed
    for (const g of [this.obstacles, this.treats, this.decor]) {
      g.children.each((c) => {
        const r = c as Img;
        (r.body as Body).setVelocityX(-this.speed);
        if (r.x < -140) r.destroy();
        return true;
      });
    }

    const remainingPx = this.level.goalMeters * SCORE.pixelsPerMeter - this.distancePx;
    if (remainingPx <= 0) {
      this.endRun('You caught the ball!', true);
      return;
    }
    if (!this.ballSpawned && remainingPx <= GAME_WIDTH - PET.homeX) this.spawnBall(remainingPx);

    // No new obstacles in the final stretch, so the finish stays clear
    this.nextSpawnIn -= dx;
    if (this.nextSpawnIn <= 0 && remainingPx > GAME_WIDTH + 200) this.spawnNext();

    if (this.sliding) {
      this.slideLeftPx -= dx;
      if (this.slideLeftPx <= 0) this.stopSlide();
    }

    this.updatePetPosition();

    // Falling off the bottom should never happen, but just in case
    if (this.pet.y > GAME_HEIGHT + 100) this.endRun('Oops!');

    this.updateHud();
  }

  // ---------- Ground and hills ----------

  /** Screen y of the top of the ground at a screen x. */
  private groundAt(screenX: number): number {
    const wx = this.distancePx + screenX;
    const g = groundYAt(this.level, wx);
    // The hills flatten out under a climbing section, so its steps are always the same height
    for (const f of this.flats) {
      if (wx <= f.from || wx >= f.to) continue;
      const t = Math.min(1, (wx - f.from) / CLIMB.flatRamp, (f.to - wx) / CLIMB.flatRamp);
      return g + ((f.y ?? GROUND_Y) - g) * t * t * (3 - 2 * t);
    }
    return g;
  }

  /**
   * Stands the pet on the ground. The ground isn't a physics body (it rolls
   * up and down on the hilly levels), so this does the landing by hand:
   * after each physics step, a pet at or below the ground is put back on
   * top of it. While running downhill it sticks to the slope instead of
   * floating off it.
   */
  private keepOnGround(): void {
    const b = this.petBody;
    let gy = this.groundAt(this.pet.x);
    // A ledge holds the pet up when it comes down onto it from above (it can
    // jump up through one from below)
    let ledge: Ledge | undefined;
    if (b.velocity.y >= 0) {
      const half = this.petW * 0.3;
      for (const l of this.ledges) {
        if (this.pet.x + half < l.img.x || this.pet.x - half > l.img.x + l.w) continue;
        const tol = this.onLedge === l ? 6 : 0;
        if (this.prevBottom <= l.top + 4 + tol && l.top < gy) {
          gy = l.top;
          ledge = l;
        }
      }
    }
    // Stick to the hill when running downhill (not when running off a ledge)
    const stick = this.grounded && b.velocity.y >= 0 && !ledge && !this.onLedge ? 12 : 0;
    this.onLedge = undefined;
    if (b.bottom >= gy - stick) {
      const landed = !this.grounded;
      this.onLedge = ledge;
      b.y = gy - b.height;
      if (b.velocity.y > 0) b.velocity.y = 0;
      this.grounded = true;
      this.lastGroundedAt = this.clock();
      // A jump pressed just before touching down happens now
      if (landed && this.state === 'playing' && !this.chasing && this.clock() - this.jumpQueuedAt < JUMP_BUFFER_MS) {
        this.jumpQueuedAt = -1000;
        this.jump();
      }
    } else {
      this.grounded = false;
    }
    // In a tunnel the pet bumps its head on the ceiling instead of jumping higher
    if (this.tunnel && b.y < TUNNEL_CEILING) {
      b.y = TUNNEL_CEILING;
      if (b.velocity.y < 0) b.velocity.y = 0;
    }
    this.prevBottom = b.bottom;
  }

  private drawGround(): void {
    // snapped to whole screen pixels
    const off = Math.round(this.distancePx * RENDER_SCALE) / RENDER_SCALE;
    const first = Math.floor(off / GROUND_COL);
    const shift = off - first * GROUND_COL;
    const cols = GROUND_TILE / GROUND_COL;
    this.groundBobs.forEach((bob, i) => {
      const x = i * GROUND_COL - shift;
      bob.x = x;
      bob.y = Math.round((this.groundAt(x + GROUND_COL / 2) - GROUND_TOP) * RENDER_SCALE) / RENDER_SCALE;
      bob.setFrame((first + i) % cols);
    });
  }

  private updatePetPosition(): void {
    if (this.chasing) {
      this.petBody.setVelocityX(-DISTRACTION.chaseDriftSpeed);
      if (this.pet.x <= DISTRACTION.loseX) {
        const species = this.choice.species;
        this.endRun(CHASERS[species === 'cat' ? this.level.catChaser : this.level.dogChaser].ranOff);
      }
    } else if (this.returning) {
      if (this.pet.x < PET.homeX - 4) {
        this.petBody.setVelocityX(260);
      } else {
        this.petBody.setVelocityX(0);
        this.pet.x = PET.homeX;
        this.returning = false;
      }
    } else {
      this.petBody.setVelocityX(0);
    }
  }

  /** Keeps the pet sprite on its physics box and picks the right pose. */
  private updatePetSprite(): void {
    const sp = this.petSprite;
    sp.setPosition(this.pet.x, this.pet.y + this.pet.height / 2);
    // Shadow on the ground, smaller the higher the pet is
    const gy = this.onLedge?.top ?? this.shadowFloor();
    const air = Math.max(0, gy - (this.pet.y + this.pet.height / 2));
    const s = SIZE_SCALE[this.choice.size] * Math.max(0.35, 1 - air / 220);
    this.petShadow.setPosition(this.pet.x, gy + 2).setScale(s, s).setAlpha(Math.max(0.3, 1 - air / 260));
    if (this.state !== 'playing') return;
    const d = this.distraction;
    sp.setFlipX(d?.kind === 'chase' && d.active); // turned around, after the critter
    const onGround = this.grounded;
    // Lean with the slope of the hill when running on it
    const slope = (this.groundAt(this.pet.x + 12) - this.groundAt(this.pet.x - 12)) / 24;
    const lean = onGround && !this.onLedge ? Phaser.Math.RadToDeg(Math.atan(slope)) * (sp.flipX ? -1 : 1) : 0;
    sp.setAngle(d?.kind === 'gawk' && d.active ? -12 : lean); // looking up at the bird or den
    if (onGround && !this.wasOnGround) this.dust(5); // landing puff
    this.wasOnGround = onGround;
    const stopped = this.speed < BRAKE.standSpeed && !this.chasing && !this.returning;
    if (onGround && !this.distraction && !stopped) {
      this.dustTimer += this.game.loop.delta;
      if (this.dustTimer > 260) {
        this.dustTimer = 0;
        this.dust(1);
      }
    }
    const look = this.look;
    if (this.sliding || !onGround) this.standing = false;
    if (this.sliding) {
      sp.anims.stop();
      sp.setTexture(look.slide);
    } else if (!onGround) {
      sp.anims.stop();
      sp.setTexture(look.jump);
    } else if (stopped) {
      // Standing still: hold the first frame of the run
      if (!this.standing) {
        this.standing = true;
        sp.play(look.anim);
        sp.anims.pause(sp.anims.currentAnim?.frames[0]);
      }
    } else {
      if (this.standing) {
        this.standing = false;
        sp.anims.resume();
      }
      if (!sp.anims.isPlaying) sp.play(look.anim);
      sp.anims.timeScale = this.speed / this.level.speed.start;
    }
  }

  /** Where the pet's shadow falls: the highest ledge under it, or the ground. */
  private shadowFloor(): number {
    let y = this.groundAt(this.pet.x);
    const bottom = this.pet.y + this.pet.height / 2;
    for (const l of this.ledges) {
      if (this.pet.x >= l.img.x && this.pet.x <= l.img.x + l.w && l.top >= bottom - 2 && l.top < y) y = l.top;
    }
    return y;
  }

  // ---------- Obstacles, treats and the ball ----------

  private pickObstacle(): ObstacleKind {
    const queued = this.obstacleQueue.shift();
    if (queued) return queued;
    const entries = Object.entries(this.level.obstacles) as [ObstacleKind, number][];
    let roll = Math.random() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [k, w] of entries) {
      roll -= w;
      if (roll <= 0) return k;
    }
    return entries[0][0];
  }

  private spawnNext(): void {
    const x = GAME_WIDTH + 60;
    this.flats = this.flats.filter((f) => f.to > this.distancePx - 200);
    const remainingPx = this.level.goalMeters * SCORE.pixelsPerMeter - this.distancePx;
    if (this.tunnel) {
      this.spawnInTunnel(x);
      return;
    }
    if (this.distancePx >= this.nextDigAt && remainingPx > CLIMB.clearEndPx + TUNNEL.lengthPx) {
      this.spawnDigSpot(x);
      return;
    }
    if (this.distancePx >= this.nextClimbAt && remainingPx > CLIMB.clearEndPx) {
      // A climbing section instead of the next obstacle
      const span = this.spawnClimb(x);
      const c = this.level.climb!;
      this.nextClimbAt = this.distancePx + Phaser.Math.Between(c.everyM[0], c.everyM[1]) * SCORE.pixelsPerMeter;
      this.nextSpawnIn = span + SPAWN.minGap * (this.baseSpeed / this.level.speed.start);
      return;
    }
    const kind = this.pickObstacle();
    const d = OBSTACLES[kind].decor;
    if (d && 'tree' in d) {
      // A tree: placed a little farther out, with the ground made level under its roots
      const tx = x + TREE_LEAD;
      const level = groundYAt(this.level, this.distancePx + tx + 100);
      this.flats.push({ from: this.distancePx + tx + TREE_FLAT[0] - CLIMB.flatRamp, to: this.distancePx + tx + TREE_FLAT[1] + CLIMB.flatRamp, y: level });
      this.placeObstacle(tx, kind);
    } else {
      this.placeObstacle(x, kind);
    }
    if (Math.random() < SPAWN.treatChance) this.spawnTreats(x + 220);

    // Gaps grow with speed so the game stays fair as it speeds up
    const scale = this.baseSpeed / this.level.speed.start;
    this.nextSpawnIn = Phaser.Math.Between(SPAWN.minGap, SPAWN.maxGap) * scale;
    // A tree went in farther out, so the gap after it starts from there
    if (d && 'tree' in d) this.nextSpawnIn += TREE_LEAD;
    // The tutorial's last stop (calling the pet back) gets a clear stretch of trail
    if (this.tut && !this.obstacleQueue.length) this.nextSpawnIn = 1800;
  }

  /** One obstacle on the trail at x, with its tree, poles or shadow. */
  private placeObstacle(x: number, kind: ObstacleKind): void {
    const gy = this.groundAt(x);
    const o = OBSTACLES[kind];
    const d = o.decor;
    if (d && 'tree' in d) {
      // A tree beside the trail with its low limb reaching over the path
      const [ox, oy] = TREE_ORIGIN[d.tree] ?? [0.29, 0.65];
      if (this.textures.exists(d.tree)) this.addDecor(this.art(this.add.image(x, gy - o.lift, d.tree).setOrigin(ox, oy).setDepth(0.95)));
    } else if (d) {
      // An awning, a stone arch, a clothesline or a banner held up on poles
      for (const dx of d.poles) {
        const pole = this.add.image(x + dx, gy, d.pole ?? 'umbrella-pole').setOrigin(0.5, 1).setDisplaySize(d.width, d.height).setDepth(0.95);
        if (d.tint !== 0xffffff) pole.setTint(d.tint);
        this.addDecor(pole);
      }
    }
    if (!o.slide && !o.flat && !o.ground) {
      // a soft shadow where it sits on the ground
      const w = artBox(this, kind).w / resOf(this, kind);
      this.addDecor(this.add.image(x, gy, 'shadow').setDisplaySize(w * 1.15, 9).setDepth(0.97));
    }
    this.addObstacle(x, gy - o.lift, kind);
    if (o.slide) this.hint(`slide-${kind}`, 'Swipe down to slide under!');
    else this.hint(`jump-${kind}`, kind === 'puddle' ? 'Tap to jump the puddle!' : kind === 'creek' ? 'Jump the creek!' : kind === 'pond' ? 'Jump the pond!' : 'Tap to jump!');
  }

  private addDecor(img: Img): void {
    this.decor.add(img);
    (img.body as Body).setVelocityX(-this.speed);
  }

  private addObstacle(x: number, y: number, key: string): void {
    const r = this.art(this.add.image(x, y, key).setDepth(1));
    this.obstacles.add(r);
    const k = OBSTACLES[key as ObstacleKind];
    const spin: Phaser.GameObjects.Image[] = [r];
    if (k?.flat) {
      // lies flat, so it tilts with the hill under it
      r.setRotation(Math.atan2(this.groundAt(x + 30) - this.groundAt(x - 30), 60));
    } else {
    }
    if (key === 'tumbleweed') this.tweens.add({ targets: spin, angle: -360, duration: 900, repeat: -1 });
    const body = r.body as Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setVelocityX(-this.speed);
    // Forgiving hit areas: a little smaller than the picture, so brushing a
    // leaf tip or a fence-post corner doesn't count as a bump. Things to
    // jump over lose some height from the top; things to slide under keep
    // their bottom edge where it is, so a standing pet still hits them.
    // Measured from the painted part of the picture: a painted prop can sit in
    // clear space.
    // (Sizes here are in the texture's own pixels: the body scales with the image.)
    const box = artBox(this, key);
    const share = k?.hit ?? HITBOX;
    const w = box.w * share.width;
    const x0 = box.x + (box.w - w) / 2;
    if (k?.flat) {
      // a thin band just above the ground line, whatever size the picture is
      const res = resOf(this, key);
      body.setSize(w, FLAT_HIT_H * res, false);
      body.setOffset(x0, r.height / 2 + (k.lift - FLAT_HIT_H) * res);
    } else if (k?.slide) {
      body.setSize(w, box.h, false);
      body.setOffset(x0, box.y);
    } else {
      const h = box.h * share.height;
      body.setSize(w, h, false);
      body.setOffset(x0, box.y + box.h - h);
    }
  }

  private spawnTreats(x: number): void {
    this.treatsSpawned += 4;
    const high = Math.random() < 0.5;
    for (let i = 0; i < 4; i++) {
      const tx = x + i * 45;
      const gy = this.groundAt(tx);
      const y = high ? gy - 120 - Math.sin((i / 3) * Math.PI) * 50 : gy - 30;
      const t = this.art(this.add.image(tx, y, this.choice.species === 'cat' ? 'fish' : 'bone').setDepth(1));
      this.treats.add(t);
      const body = t.body as Body;
      body.setAllowGravity(false);
      body.setVelocityX(-this.speed);
    }
  }

  /** The thrown ball waits on the trail; reaching it finishes the level. */
  private spawnBall(remainingPx: number): void {
    this.ballSpawned = true;
    const x = PET.homeX + this.petW / 2 + remainingPx;
    this.addDecor(this.art(this.add.image(x, this.groundAt(x) - 14, 'ball').setDepth(1)));
    this.toast('There’s the ball!', '#1f6f2a');
  }

  private collectTreat(t: Img): void {
    if (!t.active) return;
    this.treatPop(t.x, t.y);
    const golden = t.getData('golden') as number | boolean | undefined;
    if (golden) {
      // the golden treat at the top of a climb or the end of a tunnel
      const pts = typeof golden === 'number' ? golden : CLIMB.goldenBonus;
      this.bonus += pts;
      this.toast(`${this.tunnel ? 'Buried treasure!' : 'Top of the climb!'} +${pts}`, '#b8860b');
      sfx.ding();
    } else {
      this.treatCount += 1;
    }
    t.destroy();
    sfx.crunch();
  }

  // ---------- Slide ----------

  private startSlide(): void {
    if (!this.sliding) {
      this.sliding = true;
      sfx.slide();
      this.setPetHeight(Math.round(PET.slideHeight * SIZE_SCALE[this.choice.size]));
    }
    this.slideLeftPx = PET.slideDistance;
  }

  private stopSlide(): void {
    if (!this.sliding) return;
    this.sliding = false;
    this.setPetHeight(this.petH);
  }

  /**
   * A sliding pet's hit box is short so it fits under branches, which left the
   * low treat rows just above it (on a hill they missed by a pixel or two).
   * Treats are never harmful, so while sliding they're picked up anywhere in
   * the pet's standing height.
   */
  private reachTreatsWhileSliding(): void {
    const b = this.petBody;
    const top = b.bottom - Math.round(PET.height * SIZE_SCALE[this.choice.size]);
    for (const c of this.treats.getChildren()) {
      const t = c as Img;
      const tb = t.body as Body | null;
      if (!t.active || !tb) continue;
      if (tb.right < b.left || tb.left > b.right || tb.bottom < top || tb.top > b.bottom) continue;
      this.collectTreat(t);
    }
  }

  private setPetHeight(h: number): void {
    const bottom = this.petBody.bottom;
    this.pet.setSize(this.petW, h);
    this.petBody.setSize(this.petW, h);
    this.pet.y = bottom - h / 2;
    this.petBody.updateFromGameObject();
  }

  // ---------- Distractions ----------

  private scheduleDistraction(delayMs: number): void {
    this.scheduleTimer?.remove();
    this.scheduleTimer = this.time.delayedCall(delayMs, () => {
      if (this.state !== 'playing') return;
      if (!this.distraction && (this.obstacleAhead() || this.greet || this.ledges.length || this.braking || this.digSpot || this.tunnel)) {
        // Wait until the pet has cleared what's coming, so a distraction
        // never lands right on top of a fence or branch.
        this.scheduleDistraction(DISTRACTION.retryMs);
        return;
      }
      if (!this.distraction) {
        const gawk = this.pickGawk();
        // A neighbor with a treat is a chance, not a problem: stop to get it
        if (gawk === 'person') this.startGreet();
        else if (Math.random() < DISTRACTION.chaseChance) this.startChase();
        else this.startGawk(gawk);
      }
      this.scheduleDistraction(Phaser.Math.Between(DISTRACTION.minEveryMs, DISTRACTION.maxEveryMs));
    });
  }

  private pickGawk(): GawkKind {
    const cat = this.choice.species === 'cat';
    // Dogs stare into den holes; cats stare at butterflies. Neighbors have treats for both.
    const options = this.level.gawk.filter((g) => (cat ? g !== 'den' : g !== 'butterfly'));
    return Phaser.Utils.Array.GetRandom(options.length ? options : ['bird']);
  }

  private obstacleAhead(): boolean {
    const reach = this.pet.x + this.speed * (DISTRACTION.clearAheadMs / 1000);
    let found = false;
    this.obstacles.children.each((c) => {
      const o = c as Img;
      if (o.x + o.displayWidth / 2 > this.pet.x - this.petW / 2 && o.x - o.displayWidth / 2 < reach) found = true;
      return true;
    });
    return found;
  }

  /** Something on the trail dashes past the pet the wrong way. */
  private startChase(): void {
    const cat = this.choice.species === 'cat';
    const c = CHASERS[cat ? this.level.catChaser : this.level.dogChaser];
    const sq = this.art(this.add.sprite(GAME_WIDTH + 30, 0, c.texture).setDepth(1));
    if (c.anim) sq.play(c.anim);
    // It runs along the ground (over the hills too) with little hops
    const hop = { h: 0 };
    const place = () => sq.setY(this.groundAt(sq.x) - c.lift - hop.h);
    place();
    // Fast enough that it has just dashed past the pet when the warning ends
    this.tweens.add({ targets: sq, x: -60, duration: 1300, onUpdate: place, onComplete: () => sq.destroy() });
    this.tweens.add({ targets: hop, h: c.hop, duration: 130, yoyo: true, repeat: 4, ease: 'Sine.easeOut' });
    if (['crab', 'frog', 'lizard'].includes(c.texture)) this.tweens.add({ targets: sq, angle: { from: -8, to: 8 }, duration: 90, yoyo: true, repeat: 7 });

    this.warn('chase', '!', DISTRACTION.chaseWarnMs, () => {
      this.setSpeedFactor(DISTRACTION.chaseSpeedFactor, 300);
      this.toast(`${c.label}! Swipe up!`, '#d6402b');
      this.petSound(2);
      this.hint('chase', 'Your pet turned around! Swipe up to call it back.');
    });
  }

  /** Something out of reach: a bird in the sky, a gull, a butterfly or a critter in a den hole. */
  private startGawk(what: GawkKind): void {
    const flyer = FLYERS[what];
    if (flyer) {
      const bird = this.art(this.add.sprite(GAME_WIDTH + 40, flyer.y, `${flyer.texture}-0`).setDepth(1), 1.3);
      bird.play(`${flyer.texture}-flap`);
      this.tweens.add({ targets: bird, x: -60, duration: flyer.ms, onComplete: () => bird.destroy() });
      this.tweens.add({ targets: bird, y: flyer.y - 30, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      if (what === 'pigeon' || what === 'duck') {
        // pigeons and ducks come in pairs
        const two = this.art(this.add.sprite(GAME_WIDTH + 100, flyer.y + 24, `${flyer.texture}-1`).setDepth(1), 1.1).play(`${flyer.texture}-flap`);
        this.tweens.add({ targets: two, x: 0, duration: flyer.ms, onComplete: () => two.destroy() });
      }
    } else if (what === 'person') {
      // A neighbor strolls by on the sidewalk and waves hello
      const gy = this.groundAt(GAME_WIDTH + 40);
      const p = this.art(this.add.sprite(GAME_WIDTH + 40, gy + 2, 'person-0').setOrigin(0.5, 1).setDepth(0.85), 1.25).play('person-wave');
      this.tweens.add({ targets: p, x: -60, duration: 5200, onComplete: () => p.destroy() });
    } else if (what === 'butterfly') {
      const b = this.art(this.add.sprite(GAME_WIDTH + 30, 300, 'butterfly-0').setDepth(1), 1.3);
      b.play('butterfly-flap');
      this.tweens.add({ targets: b, x: -60, duration: 5000, onComplete: () => b.destroy() });
      this.tweens.add({ targets: b, y: 250, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      // A den dug into the verge just behind the trail. It moves with the
      // ground, follows the hills and tilts with them. The mound is cut off at
      // the hole's front edge, so none of it hangs over the trail. The critter
      // pops up out of the hole, cut off at its lower edge, behind the lip.
      const x = GAME_WIDTH + 60;
      const d = paintDen(this, this.level.id, this.level.theme);
      const back = this.art(this.add.image(0, 0, d.back).setOrigin(0.5, 1), DEN_SCALE);
      const front = this.art(this.add.image(0, 0, d.lip).setOrigin(0.5, 1), DEN_SCALE);
      // cut the bottom of both pictures off at the hole's front edge (in texture pixels)
      const cutUp = d.holeUp - d.holeHalf;
      for (const img of [back, front]) img.setCrop(0, 0, img.width, img.height - (cutUp * img.height) / DEN_H_OF(img, DEN_SCALE));
      const holeY = -d.holeUp * DEN_SCALE;
      const holeBottom = holeY + d.holeHalf * DEN_SCALE;
      const critter = this.art(this.add.image((d.holeX - d.w / 2) * DEN_SCALE, holeY + 26, 'gopher'));
      const crop = () => {
        // how much of it is above the hole's lower edge, in game pixels, then in the texture's
        const h = Math.min(critter.displayHeight, holeBottom - (critter.y - critter.displayHeight / 2));
        critter.setVisible(h > 0.5);
        if (h > 0.5) critter.setCrop(0, 0, critter.width, h / critter.scaleY);
      };
      crop();
      const parts: Phaser.GameObjects.GameObject[] = [back, critter, front];
      // grass along the cut front edge, so the hole doesn't end on a hard line
      if (d.tufts) parts.push(this.art(this.add.image((d.holeX - d.w / 2) * DEN_SCALE, -cutUp * DEN_SCALE + 2, d.tufts).setOrigin(0.5, 1), DEN_SCALE));
      const den = this.add.container(x, 0, parts).setDepth(0.92);
      den.setData('cut', cutUp * DEN_SCALE);
      this.dens.push(den);
      this.placeDen(den);
      this.tweens.add({ targets: critter, y: holeY - 6, duration: 350, yoyo: true, hold: 500, repeat: -1, repeatDelay: 250, delay: 300, onUpdate: crop });
    }

    this.warn('gawk', '?', DISTRACTION.gawkWarnMs, () => {
      this.setSpeedFactor(DISTRACTION.gawkSpeedFactor, 500);
      const msg = flyer?.msg ?? { den: 'Something in that hole! Swipe up!', butterfly: 'Butterfly! Swipe up!', person: 'Someone waving! Swipe up!' }[what as string] ?? 'Look! Swipe up!';
      this.toast(msg, '#d6402b');
      this.petSound(1);
      // Eventually the pet loses interest by itself, but you lose the time
      this.distractionTimer = this.time.delayedCall(DISTRACTION.gawkMaxMs, () => this.clearDistraction());
    });
  }

  // ---------- First-run tutorial ----------

  /** Stops the game at the right moment for the next tutorial move. */
  private checkTutorial(): void {
    const t = this.tut!;
    if (t.step < TUTORIAL_OBSTACLES.length) {
      let near = false;
      this.obstacles.children.each((c) => {
        const o = c as Img;
        const d = o.x - o.displayWidth / 2 - this.pet.x;
        if (o.texture.key === TUTORIAL_OBSTACLES[t.step] && d > 0 && d < TUTORIAL_STOP_PX) near = true;
        return true;
      });
      if (near) this.tutorialHold(t.step === 0 ? 'tap' : 'down');
    } else if (!this.distraction && this.grounded && !this.sliding) {
      this.startChase();
      this.tutorialHold('up');
    }
  }

  /** Holds the game still and shows the hand and the move to make. */
  private tutorialHold(want: TutorialMove): void {
    const t = this.tut!;
    t.want = want;
    t.since = performance.now();
    this.physics.pause();
    this.tweens.pauseAll();
    this.time.paused = true;
    this.petSprite.anims.pause();
    const touch = this.sys.game.device.input.touch;
    const words = {
      tap: touch ? 'Tap anywhere to jump the fence!' : 'Press Space to jump the fence!',
      down: touch ? 'Swipe down to slide under the branch!' : 'Press \u2193 to slide under the branch!',
      up: touch ? 'Swipe up to call your pet back!' : 'Press \u2191 to call your pet back!',
    }[want];
    const ui = this.add.container(0, 0).setDepth(30);
    const font = { fontFamily: 'Arial, sans-serif', fontStyle: 'bold', resolution: RENDER_SCALE };
    const label = this.add
      .text(GAME_WIDTH / 2, 150, words, { ...font, fontSize: '28px', color: '#fff8e8', backgroundColor: 'rgba(22,32,42,0.78)', padding: { x: 16, y: 9 } })
      .setOrigin(0.5);
    ui.add(label);
    if (want !== 'tap') {
      // a ghost arrow showing the swipe
      const g = this.add.graphics();
      const x = 640;
      const [y0, y1] = want === 'down' ? [240, 380] : [380, 240];
      const dir = Math.sign(y1 - y0);
      g.lineStyle(14, 0xffffff, 0.35).lineBetween(x, y0, x, y1 - dir * 18);
      g.fillStyle(0xffffff, 0.45).fillTriangle(x, y1 + dir * 10, x - 24, y1 - dir * 22, x + 24, y1 - dir * 22);
      ui.add(g);
    }
    t.hand = this.add.text(640, 300, '\u{1F446}', { fontSize: '64px', resolution: RENDER_SCALE }).setOrigin(0.3, 0.1);
    ui.add(t.hand);
    t.ui = ui;
  }

  /** The hand taps or swipes over and over while the game waits. */
  private animateTutorial(): void {
    const t = this.tut!;
    const hand = t.hand;
    if (!hand) return;
    const ms = performance.now() - t.since;
    if (t.want === 'tap') {
      const k = (ms % 900) / 900;
      const press = k < 0.25 ? k / 0.25 : k < 0.45 ? 1 : Math.max(0, 1 - (k - 0.45) / 0.3);
      hand.setPosition(640, 300 + press * 14).setScale(1 - press * 0.12);
    } else {
      const k = (ms % 1100) / 1100;
      const [y0, y1] = t.want === 'down' ? [230, 370] : [370, 230];
      hand.setPosition(640, y0 + (y1 - y0) * Math.min(1, k / 0.7)).setAlpha(k < 0.85 ? 1 : 1 - (k - 0.85) / 0.15);
    }
  }

  /**
   * During the tutorial only the move it asks for works, and it lets the game
   * go on. Returns false when the move should be ignored.
   */
  private tutorialMove(move: TutorialMove): boolean {
    const t = this.tut;
    if (!t?.want) return true;
    if (t.want !== move) return false;
    t.ui?.destroy();
    t.ui = undefined;
    t.hand = undefined;
    t.want = undefined;
    this.physics.resume();
    this.tweens.resumeAll();
    this.time.paused = false;
    this.petSprite.anims.resume();
    t.step += 1;
    if (t.step > TUTORIAL_OBSTACLES.length) {
      // all done: from here on it's a normal run
      this.tut = undefined;
      setTutorialDone(true);
      this.time.delayedCall(900, () => this.toast('You\u2019re ready. Fetch that ball!', this.darkSky ? '#fff8e8' : '#1d2b1f'));
      this.scheduleDistraction(DISTRACTION.firstAfterMs);
    }
    return true;
  }

  // ---------- A neighbor with a treat ----------

  /** A neighbor stands by the trail holding out a treat. Hold to stop next to them and the pet gets it. */
  private startGreet(): void {
    const x = GAME_WIDTH + 50;
    const person = this.art(this.add.sprite(x, this.groundAt(x) + 2, 'person-0').setOrigin(0.5, 1).setDepth(0.85), 1.25).play('person-wave');
    const treat = this.art(this.add.image(x - 14, 0, this.choice.species === 'cat' ? 'fish' : 'bone').setDepth(1.1), 1.2);
    treat.setTint(0xffe08a);
    this.tweens.add({ targets: treat, scale: treat.scale * 1.18, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const touch = this.sys.game.device.input.touch;
    const label = this.add
      .text(x, 0, touch ? 'Hold to stop!' : 'Hold \u2190 to stop!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#fff8e8',
        backgroundColor: 'rgba(31,111,42,0.85)',
        padding: { x: 7, y: 3 },
        resolution: RENDER_SCALE,
      })
      .setOrigin(0.5, 1)
      .setDepth(10);
    const zone = this.add.ellipse(x, 0, GREET.reach * 2, 16, 0xffe08a, 0.45).setStrokeStyle(2, 0xffffff, 0.8).setDepth(0.99);
    this.tweens.add({ targets: zone, alpha: 0.55, duration: 400, yoyo: true, repeat: -1 });
    this.greet = { person, treat, label, zone, done: false };
    this.placeGreet();
    sfx.chitter();
    this.hint('greet', touch ? 'A treat! Hold your finger down to stop by the neighbor' : 'A treat! Hold \u2190 to stop by the neighbor');
  }

  private placeGreet(): void {
    const g = this.greet;
    if (!g) return;
    const top = g.person.y - g.person.displayHeight;
    g.treat.setPosition(g.person.x - 16, top + 22);
    g.label.setPosition(g.person.x, top - 6).setVisible(!g.done);
    g.zone.setPosition(g.person.x, this.groundAt(g.person.x) + 4).setVisible(!g.done);
  }

  /** The neighbor stays put on the sidewalk (moves with the trail); stopping beside them earns the treat. */
  private updateGreet(dx: number): void {
    const g = this.greet;
    if (!g) return;
    g.person.x -= dx;
    g.person.y = this.groundAt(g.person.x) + 2;
    this.placeGreet();
    const near = Math.abs(g.person.x - this.pet.x) < GREET.reach;
    if (!g.done && near && this.speed < GREET.stopSpeed && this.grounded && !this.chasing) {
      g.done = true;
      this.tweens.killTweensOf(g.treat);
      // the treat hops from the neighbor's hand to the pet
      this.tweens.add({
        targets: g.treat,
        x: this.pet.x,
        y: this.pet.y - 10,
        duration: 320,
        ease: 'Quad.easeOut',
        onComplete: () => {
          this.treatPop(this.pet.x, this.pet.y - 20);
          g.treat.setVisible(false);
        },
      });
      this.bonus += GREET.bonus;
      this.treatCount += 1;
      this.treatsSpawned += 1;
      this.toast(`${this.choice.species === 'cat' ? 'Good kitty!' : 'Good pup!'} +${GREET.bonus}`, '#1f6f2a');
      sfx.ding();
      this.petSound(1);
    } else if (!g.done && g.person.x < this.pet.x - GREET.reach) {
      g.done = true;
      g.treat.setVisible(false);
      this.toast('Missed the treat!', this.darkSky ? '#fff8e8' : '#1d2b1f');
    }
    if (g.person.x < -60) {
      g.person.destroy();
      g.treat.destroy();
      g.label.destroy();
      g.zone.destroy();
      this.greet = undefined;
    }
  }

  // ---------- Climbing sections ----------

  /**
   * Stone ledges in steps up to a high ridge with treats (and a golden treat
   * at the far end) on top. The trail below keeps a couple of obstacles, so
   * the high road pays and the low road doesn't.
   */
  private spawnClimb(x0: number): number {
    const c = this.level.climb!;
    const k = Math.max(1, this.baseSpeed / 300); // faster runs need longer steps
    const steps = CLIMB.steps.map((st) => ({ x: x0 + st.dx * k, w: st.w * k, h: st.h }));
    const end = steps[steps.length - 1];
    const span = end.x + end.w - x0;
    // Flat ground under the section (it's still off screen to the right)
    this.flats = this.flats.filter((f) => f.to > this.distancePx);
    this.flats.push({ from: this.distancePx + x0, to: this.distancePx + x0 + span + CLIMB.flatRamp });
    const base = GROUND_Y;
    const cat = this.choice.species === 'cat';
    steps.forEach((st, i) => {
      const top = base - st.h;
      const key = ledgeTexture(this, c.style, st.w);
      const img = this.art(this.add.image(st.x, top - 4, key).setOrigin(0, 0).setDepth(1.05));
      const w = img.displayWidth;
      const pillars = (w > 300 ? [0.25, 0.75] : [0.5]).map((f) => {
        const px = st.x + w * f;
        const pk = pillarTexture(this, c.style);
        const p = this.art(this.add.image(px, top + LEDGE_H - 8, pk).setOrigin(0.5, 0).setDepth(0.94));
        p.displayHeight = this.groundAt(px) - (top + LEDGE_H - 8) + 6;
        return p;
      });
      this.ledges.push({ img, pillars, w, top });
      // Treats along the high steps, a golden one at the very end
      if (st.h >= CLIMB.treatsAbove) {
        const n = Math.max(2, Math.floor(w / 70));
        for (let j = 0; j < n; j++) {
          const golden = i === steps.length - 1 && j === n - 1;
          const t = this.art(this.add.image(st.x + 30 + j * ((w - 60) / Math.max(1, n - 1)), top - 30, cat ? 'fish' : 'bone').setDepth(1.1), golden ? 1.5 : 1);
          if (golden) {
            t.setTint(0xffd24a).setData('golden', true);
            this.tweens.add({ targets: t, angle: { from: -10, to: 10 }, duration: 400, yoyo: true, repeat: -1 });
          } else {
            this.treatsSpawned += 1;
          }
          this.treats.add(t);
          const body = t.body as Body;
          body.setAllowGravity(false);
          body.setVelocityX(-this.speed);
        }
      }
    });
    // The low road: obstacles to jump under the ridge
    const jumps = (Object.keys(this.level.obstacles) as ObstacleKind[]).filter((kd) => !OBSTACLES[kd].slide);
    for (const f of CLIMB.lowRoad) {
      if (jumps.length) this.placeObstacle(x0 + span * f, Phaser.Utils.Array.GetRandom(jumps));
    }
    this.hint('climb', 'Jump up the ledges for treats!');
    return span;
  }

  // ---------- Dig spots and tunnels ----------

  /** Loose dirt on the trail with a bone poking out. Slide on it to dig into a tunnel. */
  private spawnDigSpot(x: number): void {
    const key = paintDigSpot(this, this.level.theme.dirt);
    const img = this.art(this.add.image(x, this.groundAt(x) + 6, key).setOrigin(0.5, 1).setDepth(1.02));
    const touch = this.sys.game.device.input.touch;
    const label = this.add
      .text(x, 0, touch ? 'Swipe down to dig!' : 'Press \u2193 to dig!', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#fff8e8',
        backgroundColor: 'rgba(110,70,30,0.88)',
        padding: { x: 7, y: 3 },
        resolution: RENDER_SCALE,
      })
      .setOrigin(0.5, 1)
      .setDepth(10);
    this.digSpot = { img, label, done: false };
    const k = Math.max(1, this.baseSpeed / 300);
    // flat ground from the spot through the whole tunnel
    this.flats.push({ from: this.distancePx + x - 200, to: this.distancePx + x + (TUNNEL.lengthPx + 900) * k });
    this.nextSpawnIn = 900 * k; // a clear stretch after the spot
    const d = this.level.dig!;
    this.nextDigAt = this.distancePx + Phaser.Math.Between(d.everyM[0], d.everyM[1]) * SCORE.pixelsPerMeter;
    this.hint('dig', touch ? 'A dig spot! Swipe down on it to dig in' : 'A dig spot! Press \u2193 on it to dig in');
  }

  private updateDig(dx: number): void {
    const s = this.digSpot;
    if (s) {
      s.img.x -= dx;
      s.label.setPosition(s.img.x, s.img.y - s.img.displayHeight - 4 + Math.sin(performance.now() / 130) * 3);
      if (!s.done && this.sliding && this.grounded && Math.abs(s.img.x - this.pet.x) < TUNNEL.digReach) this.enterTunnel();
      if (s.img.x < -80) {
        s.img.destroy();
        s.label.destroy();
        this.digSpot = undefined;
      }
    }
    const t = this.tunnel;
    if (t) {
      t.strip.tilePositionX += dx / t.strip.tileScaleX;
      if (this.distancePx >= t.endAt) this.exitTunnel();
    }
  }

  /** Down the hole: a quick fade, then the run goes on underground. */
  private enterTunnel(): void {
    const s = this.digSpot!;
    s.done = true;
    s.label.setVisible(false);
    this.dust(10);
    sfx.slide();
    const k = Math.max(1, this.baseSpeed / 300);
    const cam = this.cameras.main;
    cam.fadeOut(150, 40, 26, 14);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      if (this.state !== 'playing') return;
      const key = paintTunnel(this);
      const strip = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, key).setOrigin(0, 0).setDepth(0.92).setTileScale(artScale(this, key));
      this.tunnel = { endAt: this.distancePx + TUNNEL.lengthPx * k, strip, golden: false };
      // what was on the trail stays up there (and its treats don't count against the treat star)
      this.treats.children.each((c) => {
        if (!(c as Img).getData('golden')) this.treatsSpawned -= 1;
        return true;
      });
      for (const g of [this.obstacles, this.treats, this.decor]) g.clear(true, true);
      this.dens.forEach((den) => (this.tweens.killTweensOf(den.list), den.destroy()));
      this.dens = [];
      this.fgLayer?.setVisible(false);
      this.weather.forEach((w) => w.setVisible(false));
      this.setHudDark(true);
      this.nextSpawnIn = 300;
      cam.fadeIn(220, 40, 26, 14);
      this.toast('Digging in! Bones down here', '#fff8e8');
      this.hint('tunnel', 'Jump the stones, slide under the roots');
    });
  }

  /** Light text over a dark background (a night sky or a tunnel), dark text over a light one. */
  private setHudDark(dark: boolean): void {
    this.darkSky = dark;
    this.scoreText.setColor(dark ? '#fff8e8' : '#1d2b1f').setShadow(0, 2, dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.5)', 0);
  }

  /** Out of the hole and back on the trail. */
  private exitTunnel(): void {
    const t = this.tunnel!;
    this.tunnel = undefined;
    const cam = this.cameras.main;
    cam.fadeOut(150, 40, 26, 14);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      t.strip.destroy();
      for (const g of [this.obstacles, this.decor]) g.clear(true, true);
      this.fgLayer?.setVisible(true);
      this.weather.forEach((w) => w.setVisible(true));
      this.setHudDark(this.skyIsDark);
      cam.fadeIn(220, 40, 26, 14);
      this.dust(10);
      this.toast('Back on the trail!', this.darkSky ? '#fff8e8' : '#1d2b1f');
    });
  }

  /** Underground: stones to jump, roots to slide under, and lines of buried bones. */
  private spawnInTunnel(x: number): void {
    const t = this.tunnel!;
    const k = Math.max(1, this.baseSpeed / 300);
    const left = t.endAt - (this.distancePx + x - this.pet.x);
    if (left < TUNNEL.clearEndPx * k) {
      this.nextSpawnIn = 200;
      if (!t.golden) {
        t.golden = true;
        this.addTreat(x, this.groundAt(x) - 30, true);
      }
      return;
    }
    if (Math.random() < 0.5) {
      this.placeObstacle(x, 'rock');
    } else {
      const key = paintRoots(this);
      const h = (this.textures.get(key).getSourceImage() as HTMLCanvasElement).height / resOf(this, key);
      this.addObstacle(x, TUNNEL_CEILING - 6 + h / 2, key);
      this.hint('roots', 'Swipe down to slide under the roots!');
    }
    // a line of bones, low or in a little arc
    const arc = Math.random() < 0.5;
    for (let i = 0; i < 4; i++) {
      const tx = x + 200 * k + i * 45;
      this.addTreat(tx, this.groundAt(tx) - 30 - (arc ? Math.sin((i / 3) * Math.PI) * 45 : 0));
    }
    this.nextSpawnIn = Phaser.Math.Between(TUNNEL.gap[0], TUNNEL.gap[1]) * k;
  }

  private addTreat(x: number, y: number, golden = false): void {
    const t = this.art(this.add.image(x, y, this.choice.species === 'cat' ? 'fish' : 'bone').setDepth(1.1), golden ? 1.5 : 1);
    if (golden) {
      t.setTint(0xffd24a).setData('golden', TUNNEL.goldenBonus);
      this.tweens.add({ targets: t, angle: { from: -10, to: 10 }, duration: 400, yoyo: true, repeat: -1 });
    } else {
      this.treatsSpawned += 1;
    }
    this.treats.add(t);
    const body = t.body as Body;
    body.setAllowGravity(false);
    body.setVelocityX(-this.speed);
  }

  /** Dens move with the ground, sit on it and tilt with the hill. */
  private moveDens(dx: number): void {
    if (!this.dens.length) return;
    this.dens = this.dens.filter((den) => {
      den.x -= dx;
      if (den.x < -80) {
        this.tweens.killTweensOf(den.list);
        den.destroy();
        return false;
      }
      this.placeDen(den);
      return true;
    });
  }

  private placeDen(den: Phaser.GameObjects.Container): void {
    const slope = Math.atan2(this.groundAt(den.x + 30) - this.groundAt(den.x - 30), 60);
    den.setRotation(slope);
    // the container's origin is the pictures' uncut bottom: lower it by the cut, so the hole's front edge sits on the line
    den.y = this.groundAt(den.x) - DEN_SINK + (den.getData('cut') as number);
  }

  /** Ledges and their pillars move with the trail (by hand: they're wider than the usual clean-up allows). */
  private moveLedges(dx: number): void {
    if (!this.ledges.length) return;
    this.ledges = this.ledges.filter((l) => {
      l.img.x -= dx;
      for (const p of l.pillars) {
        p.x -= dx;
        // stand the pillar on the ground under it, over the hills too
        const top = l.top + LEDGE_H - 8;
        p.displayHeight = this.groundAt(p.x) - top + 6;
      }
      if (l.img.x + l.w > -40) return true;
      l.img.destroy();
      l.pillars.forEach((p) => p.destroy());
      if (this.onLedge === l) this.onLedge = undefined;
      return false;
    });
  }

  /** Show the warning, then let the distraction take over if the player doesn't act. */
  private warn(kind: DistractionKind, mark: string, warnMs: number, onGiveIn: () => void): void {
    this.distraction = { kind, active: false };
    this.alertText.setText(mark).setVisible(true);
    this.swipeArrow.setVisible(true);
    sfx.chitter();
    this.distractionTimer?.remove();
    this.distractionTimer = this.time.delayedCall(warnMs, () => {
      if (!this.distraction || this.state !== 'playing') return;
      this.distraction.active = true;
      onGiveIn();
    });
  }

  private callBack(): void {
    sfx.whistle();
    const quick = this.distraction && !this.distraction.active;
    this.clearDistraction();
    this.doPendingMove();
    if (quick) {
      this.bonus += DISTRACTION.focusBonus;
      this.toast(`Good focus! +${DISTRACTION.focusBonus}`, '#1f6f2a');
      sfx.ding();
    } else {
      this.toast(this.choice.species === 'cat' ? 'Here, kitty!' : 'Here, pup!', '#1f6f2a');
    }
  }

  /**
   * Lets the player press up and down (or tap) together, in either order:
   * a slide or jump pressed just before the call-back happens right after it.
   * Holding the down arrow also counts.
   */
  private doPendingMove(): void {
    const p = this.pendingMove;
    this.pendingMove = undefined;
    const recent = p && this.clock() - p.at < DISTRACTION.comboWindowMs;
    // The most recent press wins; a held down arrow counts as a slide
    if (recent && p.kind === 'jump' && this.grounded) {
      this.jump();
    } else if ((recent && p.kind === 'slide') || this.downKey?.isDown) {
      this.startSlide();
    }
  }

  private clearDistraction(): void {
    this.distraction = undefined;
    this.returning = true;
    this.distractionTimer?.remove();
    this.alertText.setVisible(false);
    this.swipeArrow.setVisible(false);
    this.setSpeedFactor(1, 600);
  }

  private setSpeedFactor(target: number, ms: number): void {
    this.tweens.killTweensOf(this);
    this.tweens.add({ targets: this, speedFactor: target, duration: ms, ease: 'Sine.easeInOut' });
  }

  // ---------- Score and HUD ----------

  private meters(): number {
    return Math.floor(this.distancePx / SCORE.pixelsPerMeter);
  }

  private score(): number {
    return this.meters() + this.treatCount * SCORE.treat + this.bonus;
  }

  private updateHud(): void {
    this.scoreText.setText(`Score ${this.score()}   Treats ${this.treatCount}   Best ${this.best}`);
    this.progressFill.width = 200 * Math.min(1, this.meters() / this.level.goalMeters);
  }

  /** Shows a one-time tip the first time each thing appears in a run. */
  private hint(key: string, text: string): void {
    if (this.tut || this.shownHints.has(key)) return;
    this.shownHints.add(key);
    this.toast(text, this.darkSky ? '#fff8e8' : '#1d2b1f');
  }

  private toast(text: string, color: string): void {
    this.toastText
      .setText(text)
      .setColor(color)
      .setShadow(0, 2, color === '#fff8e8' ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.7)', 0)
      .setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 900, duration: 500 });
  }

  // ---------- Sound and effects ----------

  private petSound(times: number): void {
    if (this.choice.species === 'cat') sfx.meow();
    else sfx.bark(times);
  }

  /** Little dust puffs kicked up behind the pet's feet. */
  private dust(count: number): void {
    const x = this.pet.x - this.petW / 3;
    const y = this.pet.y + this.pet.height / 2 - 3;
    const color = { sand: 0xf3dfae, snow: 0xffffff, street: 0xc8c4bd, boards: 0xc8a882, grass: 0xd9c3a0 }[this.level.theme.tufts];
    for (let i = 0; i < count; i++) {
      const puff = this.add.circle(x + Phaser.Math.Between(-8, 8), y, Phaser.Math.Between(3, 6), color, 0.8).setDepth(1.5);
      this.tweens.add({
        targets: puff,
        x: puff.x - Phaser.Math.Between(20, 45),
        y: y - Phaser.Math.Between(4, 14),
        scale: 2,
        alpha: 0,
        duration: 450,
        onComplete: () => puff.destroy(),
      });
    }
  }

  /** A sparkle and a floating "+10" where a treat was grabbed. */
  private treatPop(x: number, y: number): void {
    const ring = this.add.circle(x, y, 8, 0xffffff, 0).setStrokeStyle(3, 0xffe08a).setDepth(5);
    this.tweens.add({ targets: ring, scale: 2.5, alpha: 0, duration: 300, onComplete: () => ring.destroy() });
    // The labels are reused: a run grabs dozens of treats, often four at a time
    const label =
      this.popPool.pop() ??
      this.add
        .text(0, 0, `+${SCORE.treat}`, { fontFamily: 'Arial, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#b8860b', resolution: RENDER_SCALE })
        .setOrigin(0.5)
        .setDepth(5);
    label.setPosition(x, y - 10).setAlpha(1).setVisible(true);
    this.tweens.add({
      targets: label,
      y: y - 50,
      alpha: 0,
      duration: 700,
      onComplete: () => {
        label.setVisible(false);
        this.popPool.push(label);
      },
    });
  }

  private confetti(): void {
    const colors = [0xd6402b, 0xf2c14e, 0x3f7d3a, 0x5aa7e6, 0xe07ab8];
    for (let i = 0; i < 70; i++) {
      const piece = this.add
        .rectangle(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(-120, -10), 8, 12, colors[i % colors.length])
        .setDepth(15);
      this.tweens.add({
        targets: piece,
        y: this.groundAt(piece.x) + Phaser.Math.Between(-10, 40),
        x: piece.x + Phaser.Math.Between(-80, 80),
        angle: Phaser.Math.Between(-360, 360),
        duration: Phaser.Math.Between(1400, 2600),
        ease: 'Sine.easeIn',
      });
    }
  }

  // ---------- Bumps, paws and pause ----------

  /** Hit an obstacle: stumble while paws are left, otherwise the run ends. */
  private bump(): void {
    if (this.state !== 'playing' || this.paused || this.time.now < this.safeUntil) return;
    this.paws -= 1;
    this.updatePaws();
    if (this.paws <= 0) {
      this.endRun('Bonk!');
      return;
    }
    this.safeUntil = this.time.now + STUMBLE_SAFE_MS;
    sfx.bonk();
    this.cameras.main.shake(150, 0.006);
    this.tweens.add({ targets: this.petSprite, alpha: 0.3, duration: 120, yoyo: true, repeat: 5, onComplete: () => this.petSprite.setAlpha(1) });
    const lost = this.pawIcons[this.paws];
    if (lost) this.tweens.add({ targets: lost, scale: { from: 1.6, to: 1 }, duration: 300 });
    this.toast(this.paws === 1 ? 'Ouch! Last paw!' : `Ouch! ${this.paws} paws left`, '#d6402b');
    // A stumble slows the pet for a moment (unless a distraction already has)
    if (!this.distraction?.active) {
      this.setSpeedFactor(0.55, 120);
      this.time.delayedCall(700, () => {
        if (this.state === 'playing' && !this.distraction?.active) this.setSpeedFactor(1, 600);
      });
    }
  }

  /** A bobbing "swipe up" arrow next to the pet while something distracts it. */
  private makeSwipeArrow(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setDepth(10).setVisible(false);
    const g = this.add.graphics();
    g.fillStyle(0xc79a3e, 1);
    g.lineStyle(3, 0x16202a, 1);
    g.beginPath();
    g.moveTo(0, -24);
    g.lineTo(18, -4);
    g.lineTo(7, -4);
    g.lineTo(7, 18);
    g.lineTo(-7, 18);
    g.lineTo(-7, -4);
    g.lineTo(-18, -4);
    g.closePath();
    g.fillPath();
    g.strokePath();
    const label = this.add
      .text(0, 32, this.sys.game.device.input.touch ? 'Swipe up' : 'Swipe up / \u2191', {
        fontFamily: 'Arial, sans-serif',
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#16202a',
        backgroundColor: 'rgba(255,248,232,0.85)',
        padding: { x: 5, y: 2 },
        resolution: RENDER_SCALE,
      })
      .setOrigin(0.5, 0);
    c.add([g, label]);
    this.tweens.add({ targets: g, y: -8, duration: 300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return c;
  }

  private updatePaws(): void {
    this.pawIcons.forEach((icon, i) => icon.setAlpha(i < this.paws ? 1 : 0.22));
  }

  private addPauseAndPaws(): void {
    this.pawIcons = [];
    for (let i = 0; i < PAWS; i++) {
      this.pawIcons.push(this.add.text(132 + i * 30, 70, '\u{1F43E}', { fontSize: '22px', resolution: RENDER_SCALE }).setOrigin(0.5).setDepth(20));
    }
    this.updatePaws();
    const btn = this.add
      .text(84, 70, '\u23F8\uFE0F', { fontSize: '24px', resolution: RENDER_SCALE })
      .setOrigin(0.5)
      .setDepth(20)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    btn.on('pointerdown', () => {
      this.uiTap = true;
      this.togglePause();
    });
    this.pauseBtn = btn;
  }

  private togglePause(): void {
    if (this.paused) this.resume();
    else this.pause();
  }

  private pause(): void {
    if (this.state !== 'playing' || this.paused || this.tut?.want) return;
    this.paused = true;
    this.physics.pause();
    this.tweens.pauseAll();
    this.time.paused = true;
    this.anims.pauseAll();
    this.weather.forEach((w) => w.pause());
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setAlpha(0);
    this.centerText.setFontSize(30).setText('Paused\n\nTap or press Space to keep going');
    this.pauseBtn?.setText('\u25B6\uFE0F');
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.physics.resume();
    this.tweens.resumeAll();
    this.time.paused = false;
    this.anims.resumeAll();
    this.weather.forEach((w) => w.resume());
    this.centerText.setText('');
    this.pauseBtn?.setText('\u23F8\uFE0F');
    this.startedAt = this.time.now;
  }

  /** Small speaker button in the top-left corner, under the score. */
  private addMuteButton(): void {
    const btn = this.add
      .text(36, 70, sfx.isMuted() ? '\u{1F507}' : '\u{1F50A}', { fontSize: '26px', resolution: RENDER_SCALE })
      .setOrigin(0.5)
      .setDepth(20)
      .setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => {
      this.uiTap = true;
      sfx.unlock();
      sfx.setMuted(!sfx.isMuted());
      btn.setText(sfx.isMuted() ? '\u{1F507}' : '\u{1F50A}');
    });
  }

  // ---------- Pet and scenery ----------

  /** Sizes the physics box and sprite to the chosen pet and starts its run animation. */
  private applyPet(): void {
    this.look = this.petLook();
    const scale = SIZE_SCALE[this.choice.size];
    this.petW = Math.round(PET.width * scale);
    this.petH = Math.round(PET.height * scale);
    this.setPetHeight(this.petH);
    this.petSprite.setOrigin(this.look.originX, 1).setScale(this.look.scale * scale).clearTint();
    if (this.look.tint !== undefined) this.petSprite.setTint(this.look.tint);
    this.petSprite.play(this.look.anim);
    // one sprite per marking layer, kept in step with the pet (see syncMarks)
    this.petMarks.forEach((m) => m.destroy());
    this.petMarks = this.look.marks.map((k, i) => this.add.sprite(this.petSprite.x, this.petSprite.y, k.run, 0).setOrigin(this.look.originX, 1).setDepth(2.01 + i * 0.001));
    this.syncMarks();
  }

  /** How the pet is drawn now: its painted sheet once that's loaded, otherwise the code-drawn pet. */
  private petLook(): PetLook {
    return petLookFor(this, this.choice);
  }

  /** Fetches the chosen pet's painted sprites if they aren't here yet, then switches to them. */
  private loadLook(): void {
    if (!queuePetArt(this, this.choice)) return;
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!this.sys.isActive() || !this.petSprite?.active) return;
      this.applyPet();
      this.updatePetSprite();
      refreshPetFrames(this.cardHost());
    });
    this.load.start();
  }

  /** Marking layers follow the pet: same picture frame, place, size, tilt and fade. */
  private syncMarks(): void {
    const sp = this.petSprite;
    const base = sp.texture.key;
    this.petMarks.forEach((m, i) => {
      const k = this.look.marks[i];
      if (base === this.look.jump) m.setTexture(k.jump);
      else if (base === this.look.slide) m.setTexture(k.slide);
      else m.setTexture(k.run, sp.frame.name);
      m.setPosition(sp.x, sp.y).setScale(sp.scaleX, sp.scaleY).setAngle(sp.angle).setFlipX(sp.flipX).setAlpha(sp.alpha * (k.alpha ?? 1)).setVisible(sp.visible);
      const tint = k.tint ?? 0xffffff;
      m.setTint(this.petDim ? dim(tint) : tint);
    });
  }

  private drawBackground(): void {
    const t = this.level.theme;
    if (t.skyImage && this.textures.exists(`sky-${this.level.id}`)) {
      // A painted sky already has its sun and clouds
      const sky = this.add.image(0, 0, `sky-${this.level.id}`).setOrigin(0, 0);
      if (t.skyFit) sky.setPosition(t.skyFit.x, t.skyFit.y).setScale(t.skyFit.scale * (1280 / sky.width));
      else sky.setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    } else {
      this.drawSky();
    }
    t.layers.forEach((l, i) => {
      const scale = l.scale ?? 1;
      // Painted strips have 4 clear rows on top. Showing from row 2 to just short of
      // the bottom keeps the strip's top and bottom edges from bleeding into each other.
      const h = l.src ? Math.round((this.textures.get(l.key).getSourceImage().height - 4) * scale) : (l.h ?? 0);
      // A strip shown smaller than the screen's pixels is shrunk once, ahead of
      // time, with the browser's good filter (the GPU's quick one makes leaves
      // shimmer as they scroll). It keeps the same size and speed on screen.
      const shrunk = l.src && scale * RENDER_SCALE < 1;
      const key = shrunk ? resized(this, l.key, scale * RENDER_SCALE) : l.key;
      const tileScale = shrunk ? 1 / RENDER_SCALE : scale;
      const tile = this.addLayer(key, GROUND_Y - h - (l.lift ?? 0), h, l.factor * scale);
      if (tileScale !== 1) tile.setTileScale(tileScale);
      if (l.src) tile.tilePositionY = (2 * scale) / tileScale;
      if (l.tint !== undefined) tile.setTint(l.tint);
      if (i > 0) return;
      if (t.sunGlint && t.sun) {
        // The low sun's reflection stays put on the water while the waves drift
        for (let k = 0; k < 9; k++) {
          const w = t.sun.r * (1.5 - k * 0.12);
          const glint = this.add.rectangle(t.sun.x, 322 + k * 12, w, 4, 0xffd27a, 0.75 - k * 0.06);
          this.tweens.add({ targets: glint, scaleX: { from: 0.8, to: 1.15 }, duration: 900 + k * 130, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        }
      }
      // A pale haze between the far and near layers adds depth
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, t.haze, 0.12).setOrigin(0, 0);
    });
    // Atmosphere: the scenery fades a little toward the trail. Things on the
    // trail stay crisp, with dark edges, so they stand out from what's behind.
    const haze = this.add.graphics();
    haze.fillGradientStyle(t.haze, t.haze, t.haze, t.haze, 0, 0, TRAIL_HAZE, TRAIL_HAZE);
    haze.fillRect(0, 120, GAME_WIDTH, GROUND_Y - 120);
    haze.fillStyle(t.haze, TRAIL_HAZE);
    haze.fillRect(0, GROUND_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_Y);
    // Night gets a soft wash over everything behind the trail
    if (t.night) this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x0f1a3a, 0.18).setOrigin(0, 0);
  }

  /** Sky drawn in code: gradient, stars, sun or moon, drifting clouds. */
  private drawSky(): void {
    const t = this.level.theme;
    const sky = this.add.graphics();
    sky.fillGradientStyle(t.skyTop, t.skyTop, t.skyBottom, t.skyBottom, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    if (t.night) this.addStars();
    if (t.sun) {
      const sun = t.sun;
      // Sun with a soft glow and slow-turning rays (or the moon, on a night level)
      if (t.raysAlpha > 0) {
        const rays = this.add.image(sun.x, sun.y, 'rays').setScale((sun.r * 4) / 400).setAlpha(t.raysAlpha);
        this.tweens.add({ targets: rays, angle: 360, duration: 90000, repeat: -1 });
      }
      this.add.circle(sun.x, sun.y, sun.r * 1.9, sun.glow, 0.12);
      this.add.circle(sun.x, sun.y, sun.r * 1.35, sun.glow, 0.25);
      this.add.circle(sun.x, sun.y, sun.r, sun.color);
      if (t.night) {
        // a few soft craters
        for (const [dx, dy, r] of [[-12, -8, 7], [10, 6, 9], [-4, 16, 5], [14, -14, 4]]) this.add.circle(sun.x + dx, sun.y + dy, r, 0xd9d6c0, 0.7);
      }
    }
    const clouds = this.addLayer('clouds', 20, 160, 0.08).setAlpha(t.cloudsAlpha);
    if (t.cloudTint !== undefined) clouds.setTint(t.cloudTint);
  }

  /** Twinkling stars for a night sky. */
  private addStars(): void {
    const rand = new Phaser.Math.RandomDataGenerator(['stars']);
    for (let i = 0; i < 70; i++) {
      const star = this.add.circle(rand.between(0, GAME_WIDTH), rand.between(0, 300), rand.realInRange(0.7, 1.8), 0xffffff, rand.realInRange(0.4, 0.95));
      if (i % 4 === 0) this.tweens.add({ targets: star, alpha: 0.15, duration: rand.between(700, 1800), yoyo: true, repeat: -1, delay: rand.between(0, 1500) });
    }
  }

  /** Rain, snow, falling leaves or petals, or fireworks over the pier. */
  private startWeather(): void {
    const w = this.level.theme.weather;
    if (w === 'rain') {
      this.weather.push(
        this.add
          .particles(0, -20, 'raindrop', {
            x: { min: -60, max: GAME_WIDTH + 200 },
            speedY: { min: 760, max: 920 },
            speedX: { min: -190, max: -150 },
            rotate: 11,
            lifespan: 800,
            frequency: 14,
            quantity: 2,
            alpha: { min: 0.3, max: 0.65 },
          })
          .setDepth(3),
      );
    } else if (w === 'snow' || w === 'leaves' || w === 'petals') {
      const look = {
        snow: { texture: 'snowflake', tint: [0xffffff], every: 55, spin: 0, scale: { min: 0.35, max: 1 } },
        leaves: { texture: 'leaf', tint: [0xd9692a, 0xc9452c, 0xe8b030, 0xb5552a], every: 260, spin: 360, scale: { min: 0.7, max: 1.2 } },
        petals: { texture: 'petal', tint: [0xf4b6c8, 0xfbdde6, 0xe8a0b8], every: 150, spin: 300, scale: { min: 0.7, max: 1.3 } },
      }[w];
      const e = this.add
        .particles(0, -10, look.texture, {
          x: { min: -40, max: GAME_WIDTH + 260 },
          speedY: { min: 40, max: 95 },
          speedX: { min: -90, max: -30 },
          scale: { min: artScale(this, look.texture, look.scale.min), max: artScale(this, look.texture, look.scale.max) },
          alpha: { min: 0.7, max: 1 },
          tint: look.tint,
          rotate: look.spin ? { start: 0, end: look.spin } : 0,
          lifespan: 9000,
          frequency: look.every,
          quantity: 1,
        })
        .setDepth(3);
      // Start with the air already full
      e.fastForward(9000, 50);
      this.weather.push(e);
    } else if (w === 'fireworks') {
      const colors = [0xff5a7a, 0xffd25a, 0x5ad0ff, 0x9aff6a, 0xd08aff];
      const bursts = colors.map((c) =>
        this.add
          .particles(0, 0, 'snowflake', {
            speed: { min: 50, max: 170 },
            lifespan: 1300,
            scale: { start: 0.9, end: 0 },
            alpha: { start: 1, end: 0.2 },
            gravityY: 70,
            tint: c,
            emitting: false,
          }),
      );
      // Bursts go in the sky: behind the sea and the carnival, in front of the stars
      const firstLayer = this.layers[0]?.tile;
      if (firstLayer) bursts.forEach((e) => this.children.moveBelow(e as never, firstLayer as never));
      this.weather.push(...bursts);
      this.time.addEvent({
        delay: 1100,
        loop: true,
        callback: () => {
          const b = Phaser.Utils.Array.GetRandom(bursts);
          b.explode(46, Phaser.Math.Between(80, GAME_WIDTH - 80), Phaser.Math.Between(60, 220));
        },
      });
    }
  }

  /** Sizes a picture painted in code (which holds RENDER_SCALE pixels per game pixel) to `scale` times its game size. */
  private art<T extends Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>(o: T, scale = 1): T {
    o.setScale(artScale(this, o.texture.key, scale));
    return o;
  }

  private addLayer(key: string, y: number, h: number, factor: number): Phaser.GameObjects.TileSprite {
    const tile = this.add.tileSprite(0, y, GAME_WIDTH, h, key).setOrigin(0, 0);
    this.layers.push({ tile, factor });
    return tile;
  }

  private makeAnimations(): void {
    // Made once all its pictures exist: a level loads only the painted critters it uses
    const flap = (key: string, frames: string[], rate: number) => {
      if (!frames.every((k) => this.textures.exists(k))) return;
      const made = this.anims.get(key);
      if (made && made.frames.length === frames.length) return;
      if (made) this.anims.remove(key);
      this.anims.create({ key, frames: frames.map((k) => ({ key: k })), frameRate: rate, repeat: -1 });
    };
    flap('butterfly-flap', ['butterfly-0', 'butterfly-1'], 10);
    flap('bird-flap', ['bird-0', 'bird-1'], 8);
    flap('gull-flap', ['gull-0', 'gull-1'], 6);
    flap('pigeon-flap', ['pigeon-0', 'pigeon-1'], 9);
    flap('duck-flap', ['duck-0', 'duck-1'], 8);
    flap('owl-flap', ['owl-0', 'owl-1'], 4);
    flap('cardinal-flap', ['cardinal-0', 'cardinal-1'], 9);
    flap('person-wave', ['person-0', 'person-1'], 4);
    flap('crow-flap', ['crow-0', 'crow-1'], 8);
    flap('hawk-flap', ['hawk-0', 'hawk-1'], 4);
    flap('parrot-flap', ['parrot-0', 'parrot-1'], 10);
    flap('balloon-flap', ['balloon-0', 'balloon-1'], 2);
  }
}

/** A pet color dimmed for the game-over moment. */
function dim(color: number): number {
  const f = 0.6;
  return (Math.round(((color >> 16) & 255) * f) << 16) | (Math.round(((color >> 8) & 255) * f) << 8) | Math.round((color & 255) * f);
}

/** The textures a level's obstacles need (with their trees and poles), and the treats and ball. */
function propKeys(kinds: ObstacleKind[]): string[] {
  const keys = ['bone', 'fish', 'ball'];
  for (const kind of kinds) {
    keys.push(kind);
    const d = (OBSTACLES as Record<string, ObstacleDef | undefined>)[kind]?.decor;
    if (d && 'tree' in d) keys.push(d.tree);
    else if (d) keys.push(d.pole ?? 'umbrella-pole');
  }
  return keys;
}

/** The critters a level can show (both pets' chasers, its gawks and its den), so their pictures load. */
function critterKeys(l: LevelDef): string[] {
  const keys: string[] = [];
  // a two-frame critter needs both frames
  const add = (t: string) => {
    const pair = /^(.*)-[01]$/.exec(t);
    if (pair) keys.push(`${pair[1]}-0`, `${pair[1]}-1`);
    else keys.push(t);
  };
  for (const c of [l.dogChaser, l.catChaser]) add(CHASERS[c].texture);
  for (const g of l.gawk) {
    const f = FLYERS[g];
    if (f) add(`${f.texture}-0`);
    else if (g === 'den') keys.push('gopher', ...denFiles(l.theme));
    else add(`${g}-0`);
  }
  return keys;
}
