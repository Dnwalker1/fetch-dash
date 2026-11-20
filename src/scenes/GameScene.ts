import Phaser from 'phaser';
import { makeTextures } from '../art/textures';
import { paintProps } from '../art/props';
import { paintCritters } from '../art/critters';
import { GROUND_COL, GROUND_TILE, GROUND_TOP, paintGround } from '../art/ground';
import { makeLevelArt } from '../art/levelArt';
import { makeLevelArt2 } from '../art/levelArt2';
import { makeLevelArt3 } from '../art/levelArt3';
import * as sfx from '../audio/sfx';
import { SIZE_SCALE, loadPet, makePetTextures, petKey, savePet, type PetChoice } from '../art/pets';
import { DISTRACTION, GAME_HEIGHT, GAME_WIDTH, GROUND_Y, PET, SCORE, SPAWN } from '../config';
import { groundYAt, levelById, loadProgress, saveProgress, LEVELS, TREAT_STAR_SHARE, type ChaserKind, type GawkKind, type LevelDef, type ObstacleKind, type Progress } from '../levels';
import { cardsOpen, closeCards, isUiEvent, openEnd, openHome, openSetup, type CardHost } from '../ui/cards';
import { loadHero } from '../hero/store';

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

const SWIPE_PX = 30; // screen pixels
/** Obstacle hit areas as a share of the picture (see addObstacle). */
const HITBOX = { width: 0.72, height: 0.8 };
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
type Decor = { tree: string; trunkTint?: number } | { poles: number[]; tint: number; width: number; height: number };
const OBSTACLES: Record<ObstacleKind, { lift: number; slide: boolean; decor?: Decor }> = {
  fence: { lift: 25, slide: false },
  puddle: { lift: 6, slide: false },
  log: { lift: 17, slide: false },
  rock: { lift: 19, slide: false },
  sandcastle: { lift: 26, slide: false },
  driftwood: { lift: 13, slide: false },
  branch: { lift: 65, slide: true, decor: { tree: 'canopy' } },
  umbrella: { lift: 66, slide: true, decor: { poles: [0], tint: 0xffffff, width: 6, height: 90 } },
  trashcan: { lift: 23, slide: false },
  hydrant: { lift: 19, slide: false },
  sign: { lift: 22, slide: false },
  awning: { lift: 64, slide: true, decor: { poles: [-56, 56], tint: 0x2b2b3a, width: 4, height: 86 } },
  stump: { lift: 18, slide: false },
  creek: { lift: 5, slide: false },
  snowman: { lift: 29, slide: false },
  sled: { lift: 13, slide: false },
  snowbranch: { lift: 65, slide: true, decor: { tree: 'snowcanopy', trunkTint: 0x8a7a70 } },
  haybale: { lift: 20, slide: false },
  pumpkin: { lift: 17, slide: false },
  autumnbranch: { lift: 65, slide: true, decor: { tree: 'canopy-autumn' } },
  cactus: { lift: 26, slide: false },
  tumbleweed: { lift: 19, slide: false },
  arch: { lift: 64, slide: true, decor: { poles: [-56, 56], tint: 0xc06a44, width: 14, height: 84 } },
  trough: { lift: 13, slide: false },
  clothesline: { lift: 64, slide: true, decor: { poles: [-62, 62], tint: 0x8a6a44, width: 5, height: 90 } },
  lantern: { lift: 23, slide: false },
  pond: { lift: 5, slide: false },
  blossombranch: { lift: 65, slide: true, decor: { tree: 'canopy-blossom' } },
  vines: { lift: 68, slide: true, decor: { tree: 'canopy-jungle' } },
  crate: { lift: 20, slide: false },
  barrel: { lift: 22, slide: false },
  banner: { lift: 63, slide: true, decor: { poles: [-62, 62], tint: 0x4a4a6a, width: 5, height: 90 } },
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
  private groundBobs: Phaser.GameObjects.Bob[] = [];
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
    return this.baseSpeed * this.speedFactor;
  }

  /** Painted pictures for the levels that have them (only fetched once). */
  preload(): void {
    for (const l of LEVELS) {
      const t = l.theme;
      if (t.skyImage && !this.textures.exists(`sky-${l.id}`)) this.load.image(`sky-${l.id}`, t.skyImage);
      for (const layer of t.layers) if (layer.src && !this.textures.exists(layer.key)) this.load.image(layer.key, layer.src);
    }
  }

  create(data?: { level?: number; auto?: boolean }): void {
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

    // Painted props go first; the flat-shape art fills in whatever they don't cover
    paintProps(this);
    paintCritters(this);
    makeTextures(this);
    makeLevelArt(this);
    makeLevelArt2(this);
    makeLevelArt3(this);
    this.makeAnimations();
    this.choice = loadPet();
    makePetTextures(this, this.choice);
    this.drawBackground();
    this.weather = [];
    this.startWeather();

    // The ground is a painted strip laid down in narrow columns, each moved
    // every frame to sit on the hill under it
    const ground = this.add.blitter(0, 0, paintGround(this, this.level.id, this.level.theme)).setDepth(0.9);
    this.groundBobs = [];
    for (let i = 0; i <= Math.ceil(GAME_WIDTH / GROUND_COL); i++) this.groundBobs.push(ground.create(0, 0, 0));

    // Pet: an invisible box does the physics, and the pet sprite is drawn on top of it
    const gy = this.groundAt(PET.homeX);
    this.pet = this.add.rectangle(PET.homeX, gy - PET.height / 2, PET.width, PET.height, PET_COLOR);
    this.pet.setVisible(false);
    this.physics.add.existing(this.pet);
    this.petBody = this.pet.body as Body;
    this.petBody.setCollideWorldBounds(false);
    this.petShadow = this.add.image(PET.homeX, gy, 'shadow').setDepth(1.9);
    this.petSprite = this.add.sprite(PET.homeX, gy, `${petKey(this.choice)}-run-0`).setOrigin(0.5, 1).setDepth(2);
    this.applyPet();

    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.treats = this.physics.add.group({ allowGravity: false });
    this.decor = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.pet, this.obstacles, () => this.bump());
    this.physics.add.overlap(this.pet, this.treats, (_p, t) => this.collectTreat(t as Img));

    // HUD
    const font = { fontFamily: 'Arial, sans-serif', color: '#1d2b1f' };
    const top = this.level.theme.skyTop;
    const dark = ((top >> 16) & 255) * 0.3 + ((top >> 8) & 255) * 0.59 + (top & 255) * 0.11 < 120;
    this.darkSky = dark;
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
      },
      petFrames: (c) => {
        const key = petKey(c);
        const cached = this.frameCache.get(key);
        if (cached) return cached;
        makePetTextures(this, c);
        const frames = [0, 1, 2].map((i) => this.textures.getBase64(`${key}-run-${i}`) as string);
        this.frameCache.set(key, frames);
        return frames;
      },
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
      this.pointerStart = { x, y, handled: false };
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
    if (this.distraction) this.callBack();
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
        .text(0, 0, '\u{1F43E} My hero', { fontFamily: 'Arial, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#16202a' })
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
    this.scheduleDistraction(DISTRACTION.firstAfterMs);
  }

  private endRun(reason: string, won = false): void {
    if (this.state !== 'playing') return;
    this.state = 'over';
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
    if (!won) this.petSprite.setTint(0x999999);
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
    this.keepOnGround();
    this.alertText.setPosition(this.pet.x, this.pet.y - 62);
    this.swipeArrow.setPosition(this.pet.x + 46, this.pet.y - 66);
    this.updatePetSprite();
    this.drawGround();
    if (this.state !== 'playing' || this.paused) return;
    const dt = deltaMs / 1000;

    const sp = this.level.speed;
    this.baseSpeed = Math.min(sp.max, this.baseSpeed + sp.gainPerSecond * dt);
    const dx = this.speed * dt;
    this.distancePx += dx;

    // Scroll the background layers; farther layers move slower
    for (const l of this.layers) l.tile.tilePositionX += dx * l.factor;

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
    return groundYAt(this.level, this.distancePx + screenX);
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
    const gy = this.groundAt(this.pet.x);
    const stick = this.grounded && b.velocity.y >= 0 ? 12 : 0;
    if (b.bottom >= gy - stick) {
      const landed = !this.grounded;
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
  }

  private drawGround(): void {
    const off = Math.round(this.distancePx);
    const first = Math.floor(off / GROUND_COL);
    const shift = off - first * GROUND_COL;
    const cols = GROUND_TILE / GROUND_COL;
    this.groundBobs.forEach((bob, i) => {
      const x = i * GROUND_COL - shift;
      bob.x = x;
      bob.y = Math.round(this.groundAt(x + GROUND_COL / 2)) - GROUND_TOP;
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
    const gy = this.groundAt(this.pet.x);
    const air = Math.max(0, gy - (this.pet.y + this.pet.height / 2));
    const s = SIZE_SCALE[this.choice.size] * Math.max(0.35, 1 - air / 220);
    this.petShadow.setPosition(this.pet.x, gy + 2).setScale(s, s).setAlpha(Math.max(0.3, 1 - air / 260));
    if (this.state !== 'playing') return;
    const d = this.distraction;
    sp.setFlipX(d?.kind === 'chase' && d.active); // turned around, after the critter
    const onGround = this.grounded;
    // Lean with the slope of the hill when running on it
    const slope = (this.groundAt(this.pet.x + 12) - this.groundAt(this.pet.x - 12)) / 24;
    const lean = onGround ? Phaser.Math.RadToDeg(Math.atan(slope)) * (sp.flipX ? -1 : 1) : 0;
    sp.setAngle(d?.kind === 'gawk' && d.active ? -12 : lean); // looking up at the bird or den
    if (onGround && !this.wasOnGround) this.dust(5); // landing puff
    this.wasOnGround = onGround;
    if (onGround && !this.distraction) {
      this.dustTimer += this.game.loop.delta;
      if (this.dustTimer > 260) {
        this.dustTimer = 0;
        this.dust(1);
      }
    }
    const key = petKey(this.choice);
    if (this.sliding) {
      sp.anims.stop();
      sp.setTexture(`${key}-slide`);
    } else if (!onGround) {
      sp.anims.stop();
      sp.setTexture(`${key}-jump`);
    } else {
      if (!sp.anims.isPlaying) sp.play(`${key}-run`);
      sp.anims.timeScale = this.speed / this.level.speed.start;
    }
  }

  // ---------- Obstacles, treats and the ball ----------

  private pickObstacle(): ObstacleKind {
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
    const kind = this.pickObstacle();
    const gy = this.groundAt(x);
    const o = OBSTACLES[kind];
    const d = o.decor;
    if (d && 'tree' in d) {
      // Low branch hanging from a tree. The trunk stops just above the pet's
      // head, so it can slide under the tree.
      const trunk = this.add.image(x + 40, gy - 75, 'trunk').setOrigin(0.5, 1).setDepth(0.95);
      if (d.trunkTint !== undefined) trunk.setTint(d.trunkTint);
      this.addDecor(trunk);
      this.addDecor(this.add.image(x + 40, gy - 400, d.tree).setDepth(0.96));
    } else if (d) {
      // An awning, a stone arch, a clothesline or a banner held up on poles
      for (const dx of d.poles) {
        const pole = this.add.image(x + dx, gy, 'umbrella-pole').setOrigin(0.5, 1).setDisplaySize(d.width, d.height).setDepth(0.95);
        if (d.tint !== 0xffffff) pole.setTint(d.tint);
        this.addDecor(pole);
      }
    }
    if (!o.slide && kind !== 'puddle' && kind !== 'creek' && kind !== 'pond') {
      // a soft shadow where it sits on the ground
      const w = this.textures.get(kind).getSourceImage().width;
      this.addDecor(this.add.image(x, gy, 'shadow').setDisplaySize(w * 1.15, 9).setDepth(0.97));
    }
    this.addObstacle(x, gy - o.lift, kind);
    if (o.slide) this.hint(`slide-${kind}`, 'Swipe down to slide under!');
    else this.hint(`jump-${kind}`, kind === 'puddle' ? 'Tap to jump the puddle!' : kind === 'creek' ? 'Jump the creek!' : kind === 'pond' ? 'Jump the pond!' : 'Tap to jump!');
    if (Math.random() < SPAWN.treatChance) this.spawnTreats(x + 220);

    // Gaps grow with speed so the game stays fair as it speeds up
    const scale = this.baseSpeed / this.level.speed.start;
    this.nextSpawnIn = Phaser.Math.Between(SPAWN.minGap, SPAWN.maxGap) * scale;
  }

  private addDecor(img: Img): void {
    this.decor.add(img);
    (img.body as Body).setVelocityX(-this.speed);
  }

  private addObstacle(x: number, y: number, key: string): void {
    const r = this.add.image(x, y, key).setDepth(1);
    this.obstacles.add(r);
    if (key === 'tumbleweed') this.tweens.add({ targets: r, angle: -360, duration: 900, repeat: -1 });
    const body = r.body as Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setVelocityX(-this.speed);
    // Forgiving hit areas: a little smaller than the picture, so brushing a
    // leaf tip or a fence-post corner doesn't count as a bump. Things to
    // jump over lose some height from the top; things to slide under keep
    // their bottom edge where it is, so a standing pet still hits them.
    const k = OBSTACLES[key as ObstacleKind];
    const w = r.width * HITBOX.width;
    if (k?.slide) {
      body.setSize(w, r.height, false);
      body.setOffset((r.width - w) / 2, 0);
    } else {
      const h = r.height * HITBOX.height;
      body.setSize(w, h, false);
      body.setOffset((r.width - w) / 2, r.height - h);
    }
  }

  private spawnTreats(x: number): void {
    this.treatsSpawned += 4;
    const high = Math.random() < 0.5;
    for (let i = 0; i < 4; i++) {
      const tx = x + i * 45;
      const gy = this.groundAt(tx);
      const y = high ? gy - 120 - Math.sin((i / 3) * Math.PI) * 50 : gy - 30;
      const t = this.add.image(tx, y, this.choice.species === 'cat' ? 'fish' : 'bone').setDepth(1);
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
    this.addDecor(this.add.image(x, this.groundAt(x) - 14, 'ball').setDepth(1));
    this.toast('There’s the ball!', '#1f6f2a');
  }

  private collectTreat(t: Img): void {
    if (!t.active) return;
    this.treatPop(t.x, t.y);
    t.destroy();
    this.treatCount += 1;
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
      if (!this.distraction && this.obstacleAhead()) {
        // Wait until the pet has cleared what's coming, so a distraction
        // never lands right on top of a fence or branch.
        this.scheduleDistraction(DISTRACTION.retryMs);
        return;
      }
      if (!this.distraction) {
        if (Math.random() < DISTRACTION.chaseChance) this.startChase();
        else this.startGawk(this.pickGawk());
      }
      this.scheduleDistraction(Phaser.Math.Between(DISTRACTION.minEveryMs, DISTRACTION.maxEveryMs));
    });
  }

  private pickGawk(): GawkKind {
    const cat = this.choice.species === 'cat';
    // Dogs stare into den holes and wave back at people; cats stare at butterflies
    const options = this.level.gawk.filter((g) => (cat ? g !== 'den' && g !== 'person' : g !== 'butterfly'));
    return Phaser.Utils.Array.GetRandom(options.length ? options : ['bird']);
  }

  private obstacleAhead(): boolean {
    const reach = this.pet.x + this.speed * (DISTRACTION.clearAheadMs / 1000);
    let found = false;
    this.obstacles.children.each((c) => {
      const o = c as Img;
      if (o.x + o.width / 2 > this.pet.x - this.petW / 2 && o.x - o.width / 2 < reach) found = true;
      return true;
    });
    return found;
  }

  /** Something on the trail dashes past the pet the wrong way. */
  private startChase(): void {
    const cat = this.choice.species === 'cat';
    const c = CHASERS[cat ? this.level.catChaser : this.level.dogChaser];
    const sq = c.anim
      ? this.add.sprite(GAME_WIDTH + 30, 0, c.texture).setDepth(1).play(c.anim)
      : this.add.sprite(GAME_WIDTH + 30, 0, c.texture).setDepth(1);
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
      const bird = this.add.sprite(GAME_WIDTH + 40, flyer.y, `${flyer.texture}-0`).setDepth(1).setScale(1.3);
      bird.play(`${flyer.texture}-flap`);
      this.tweens.add({ targets: bird, x: -60, duration: flyer.ms, onComplete: () => bird.destroy() });
      this.tweens.add({ targets: bird, y: flyer.y - 30, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      if (what === 'pigeon' || what === 'duck') {
        // pigeons and ducks come in pairs
        const two = this.add.sprite(GAME_WIDTH + 100, flyer.y + 24, `${flyer.texture}-1`).setDepth(1).setScale(1.1).play(`${flyer.texture}-flap`);
        this.tweens.add({ targets: two, x: 0, duration: flyer.ms, onComplete: () => two.destroy() });
      }
    } else if (what === 'person') {
      // A neighbor strolls by on the sidewalk and waves hello
      const gy = this.groundAt(GAME_WIDTH + 40);
      const p = this.add.sprite(GAME_WIDTH + 40, gy + 2, 'person-0').setOrigin(0.5, 1).setDepth(0.85).setScale(1.25).play('person-wave');
      this.tweens.add({ targets: p, x: -60, duration: 5200, onComplete: () => p.destroy() });
    } else if (what === 'butterfly') {
      const b = this.add.sprite(GAME_WIDTH + 30, 300, 'butterfly-0').setDepth(1).setScale(1.3);
      b.play('butterfly-flap');
      this.tweens.add({ targets: b, x: -60, duration: 5000, onComplete: () => b.destroy() });
      this.tweens.add({ targets: b, y: 250, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      // A den hole on the hillside, drifting by slower than the trail (it's farther away)
      const gy = this.groundAt(GAME_WIDTH + 60);
      const den = this.add.ellipse(GAME_WIDTH + 60, gy - 48, 70, 30, 0x3a2a1a).setDepth(0.5);
      const critter = this.add.image(GAME_WIDTH + 60, gy - 58, 'gopher').setDepth(0.6);
      this.tweens.add({ targets: [den, critter], x: -80, duration: 6000, onComplete: () => (den.destroy(), critter.destroy()) });
      this.tweens.add({ targets: critter, y: gy - 84, duration: 350, yoyo: true, hold: 500, repeat: 5, delay: 300 });
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
    if (this.shownHints.has(key)) return;
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
    const label = this.add
      .text(x, y - 10, `+${SCORE.treat}`, { fontFamily: 'Arial, sans-serif', fontSize: '20px', fontStyle: 'bold', color: '#b8860b' })
      .setOrigin(0.5)
      .setDepth(5);
    this.tweens.add({ targets: label, y: y - 50, alpha: 0, duration: 700, onComplete: () => label.destroy() });
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
      this.pawIcons.push(this.add.text(132 + i * 30, 70, '\u{1F43E}', { fontSize: '22px' }).setOrigin(0.5).setDepth(20));
    }
    this.updatePaws();
    const btn = this.add
      .text(84, 70, '\u23F8\uFE0F', { fontSize: '24px' })
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
    if (this.state !== 'playing' || this.paused) return;
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
      .text(36, 70, sfx.isMuted() ? '\u{1F507}' : '\u{1F50A}', { fontSize: '26px' })
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
    makePetTextures(this, this.choice);
    const scale = SIZE_SCALE[this.choice.size];
    this.petW = Math.round(PET.width * scale);
    this.petH = Math.round(PET.height * scale);
    this.setPetHeight(this.petH);
    this.petSprite.setScale(scale).clearTint();
    this.petSprite.play(`${petKey(this.choice)}-run`);
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
      const tile = this.addLayer(l.key, GROUND_Y - h - (l.lift ?? 0), h, l.factor);
      if (scale !== 1) tile.setTileScale(scale);
      if (l.src) tile.tilePositionY = 2;
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
          scale: look.scale,
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

  private addLayer(key: string, y: number, h: number, factor: number): Phaser.GameObjects.TileSprite {
    const tile = this.add.tileSprite(0, y, GAME_WIDTH, h, key).setOrigin(0, 0);
    this.layers.push({ tile, factor });
    return tile;
  }

  private makeAnimations(): void {
    const flap = (key: string, frames: string[], rate: number) => {
      if (!this.anims.exists(key)) this.anims.create({ key, frames: frames.map((k) => ({ key: k })), frameRate: rate, repeat: -1 });
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
