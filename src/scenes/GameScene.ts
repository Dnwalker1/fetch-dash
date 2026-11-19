import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, GROUND_Y, PET, SCORE, SPAWN, SPEED, SQUIRREL } from '../config';

type State = 'ready' | 'playing' | 'over';
type Rect = Phaser.GameObjects.Rectangle;
type Body = Phaser.Physics.Arcade.Body;

const BEST_KEY = 'fetch-dash-best';
const SWIPE_PX = 30; // screen pixels

/**
 * Week 1 prototype: placeholder shapes only.
 * The pet runs on its own. Tap to jump, swipe down to slide,
 * swipe up to call the pet back when a squirrel distracts it.
 */
export class GameScene extends Phaser.Scene {
  private state: State = 'ready';
  private pet!: Rect;
  private petBody!: Body;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private treats!: Phaser.Physics.Arcade.Group;
  private decor!: Phaser.Physics.Arcade.Group;
  private shownHints = new Set<string>();

  private speed = SPEED.start;
  private distancePx = 0;
  private treatCount = 0;
  private bonus = 0;
  private best = 0;
  private nextSpawnIn = 0;

  private sliding = false;
  private slideTimer?: Phaser.Time.TimerEvent;

  private distracted = false;
  private chasing = false;
  private returning = false;
  private distractionTimer?: Phaser.Time.TimerEvent;
  private squirrelTimer?: Phaser.Time.TimerEvent;
  private squirrel?: Rect;
  private alertText!: Phaser.GameObjects.Text;

  private scoreText!: Phaser.GameObjects.Text;
  private centerText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private groundStripes: Rect[] = [];

  private pointerStart?: { x: number; y: number; handled: boolean };

  constructor() {
    super('game');
  }

  create(): void {
    this.best = loadBest();
    this.state = 'ready';
    this.speed = SPEED.start;
    this.distancePx = 0;
    this.treatCount = 0;
    this.bonus = 0;
    this.nextSpawnIn = 600;
    this.sliding = false;
    this.distracted = false;
    this.chasing = false;
    this.returning = false;
    this.groundStripes = [];
    this.shownHints = new Set<string>();

    this.drawBackground();

    // Ground (static physics body the pet stands on)
    const ground = this.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 50, GAME_WIDTH, 100, 0x6fbf5a);
    this.physics.add.existing(ground, true);
    for (let x = 0; x < GAME_WIDTH + 80; x += 80) {
      this.groundStripes.push(this.add.rectangle(x, GROUND_Y + 6, 40, 6, 0x5aa648));
    }

    // Pet (placeholder: a brown block with an ear)
    this.pet = this.add.rectangle(PET.homeX, GROUND_Y - PET.height / 2, PET.width, PET.height, 0xa86b3c);
    this.pet.setStrokeStyle(3, 0x5c3a1e);
    this.physics.add.existing(this.pet);
    this.pet.setDepth(2);
    this.petBody = this.pet.body as Body;
    this.petBody.setCollideWorldBounds(false);
    this.physics.add.collider(this.pet, ground);

    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.treats = this.physics.add.group({ allowGravity: false });
    this.decor = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.pet, this.obstacles, () => this.endRun('Bonk!'));
    this.physics.add.overlap(this.pet, this.treats, (_p, t) => this.collectTreat(t as Rect));

    // HUD
    const font = { fontFamily: 'Arial, sans-serif', color: '#1d2b1f' };
    this.scoreText = this.add.text(20, 16, '', { ...font, fontSize: '24px', fontStyle: 'bold' }).setDepth(10);
    this.centerText = this.add
      .text(GAME_WIDTH / 2, 190, '', { ...font, fontSize: '30px', fontStyle: 'bold', align: 'center' })
      .setOrigin(0.5)
      .setDepth(10);
    this.toastText = this.add
      .text(GAME_WIDTH / 2, 110, '', { ...font, fontSize: '28px', fontStyle: 'bold', color: '#1f6f2a' })
      .setOrigin(0.5)
      .setDepth(10)
      .setAlpha(0);
    this.alertText = this.add
      .text(0, 0, '!', { ...font, fontSize: '40px', fontStyle: 'bold', color: '#d6402b' })
      .setOrigin(0.5)
      .setDepth(10)
      .setVisible(false);

    this.centerText.setText(
      'FETCH DASH\n\nTap to start\n\nTap / Space: jump    Swipe down / Down: slide\nSwipe up / Up: call your pet back from squirrels'
    );
    this.centerText.setFontSize(24);
    this.updateHud();

    this.setupInput();
  }

  // ---------- Input ----------

  private setupInput(): void {
    const keys = this.input.keyboard;
    keys?.on('keydown-SPACE', () => this.onTap());
    keys?.on('keydown-DOWN', () => this.onSwipeDown());
    keys?.on('keydown-UP', () => this.onSwipeUp());

    // Touch and mouse are read straight from the page, in screen pixels.
    // Listening on the whole window means a swipe works anywhere on the
    // screen (not only on the game canvas), and preventDefault stops the
    // browser or the app around the game from scrolling instead.
    const opts: AddEventListenerOptions = { passive: false };
    const down = (x: number, y: number) => {
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
      e.preventDefault();
      const t = e.changedTouches[0];
      down(t.clientX, t.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      move(t.clientX, t.clientY);
    };
    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      up();
    };
    const onMouseDown = (e: MouseEvent) => down(e.clientX, e.clientY);
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

  private onTap(): void {
    if (this.state === 'ready') return this.startRun();
    if (this.state === 'over') return this.restart();
    if (this.chasing) return; // a chasing pet doesn't listen to jump
    if (this.petBody.blocked.down || this.petBody.touching.down) {
      this.stopSlide();
      this.petBody.setVelocityY(PET.jumpVelocity);
    }
  }

  private onSwipeDown(): void {
    if (this.state !== 'playing' || this.chasing) return;
    if (!(this.petBody.blocked.down || this.petBody.touching.down)) {
      // Fast-fall when in the air
      this.petBody.setVelocityY(900);
    }
    this.startSlide();
  }

  private onSwipeUp(): void {
    if (this.state !== 'playing') return;
    if (this.distracted || this.chasing) this.callBack();
  }

  // ---------- Run lifecycle ----------

  private startRun(): void {
    this.state = 'playing';
    this.centerText.setText('');
    this.scheduleSquirrel(SQUIRREL.firstAfterMs);
  }

  private endRun(reason: string): void {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.physics.pause();
    this.squirrelTimer?.remove();
    this.distractionTimer?.remove();
    this.alertText.setVisible(false);
    this.pet.setFillStyle(0x8a8a8a);

    const score = this.score();
    const newBest = score > this.best;
    if (newBest) {
      this.best = score;
      saveBest(score);
    }
    this.centerText.setFontSize(30);
    this.centerText.setText(
      `${reason}\n\nScore ${score}${newBest ? '  (new best!)' : ''}\n` +
        `${this.meters()} m  ·  ${this.treatCount} treats\n\nTap to run again`
    );
    this.updateHud();
  }

  private restart(): void {
    this.physics.resume();
    this.scene.restart();
  }

  // ---------- Main loop ----------

  update(_time: number, deltaMs: number): void {
    this.alertText.setPosition(this.pet.x, this.pet.y - 60);
    if (this.state !== 'playing') return;
    const dt = deltaMs / 1000;

    this.speed = Math.min(SPEED.max, this.speed + SPEED.gainPerSecond * dt);
    const dx = this.speed * dt;
    this.distancePx += dx;

    // Scroll ground stripes for a sense of speed
    for (const s of this.groundStripes) {
      s.x -= dx;
      if (s.x < -40) s.x += this.groundStripes.length * 80;
    }

    // Keep moving things in step with the current speed
    for (const g of [this.obstacles, this.treats, this.decor]) {
      g.children.each((c) => {
        const r = c as Rect;
        (r.body as Body).setVelocityX(-this.speed);
        if (r.x < -100) r.destroy();
        return true;
      });
    }

    this.nextSpawnIn -= dx;
    if (this.nextSpawnIn <= 0) this.spawnNext();

    this.updatePetPosition();

    // Falling off the bottom should never happen, but just in case
    if (this.pet.y > GAME_HEIGHT + 100) this.endRun('Oops!');

    this.updateHud();
  }

  private updatePetPosition(): void {
    if (this.chasing) {
      this.petBody.setVelocityX(-SQUIRREL.driftSpeed);
      if (this.pet.x <= SQUIRREL.loseX) this.endRun('Chased the squirrel!');
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

  // ---------- Obstacles and treats ----------

  private spawnNext(): void {
    const roll = Math.random();
    const x = GAME_WIDTH + 60;
    if (roll < 0.4) {
      this.addObstacle(x, GROUND_Y - 25, 34, 50, 0x8b5a2b); // fence: jump
      this.hint('fence', 'Tap to jump!');
    } else if (roll < 0.7) {
      this.addObstacle(x, GROUND_Y - 6, 90, 12, 0x4a90d9); // puddle: jump
      this.hint('puddle', 'Tap to jump the puddle!');
    } else {
      // Low branch hanging from a tree: slide under it
      const trunk = this.add.rectangle(x + 40, (GROUND_Y - 75) / 2, 26, GROUND_Y - 75, 0x6b4423);
      this.decor.add(trunk);
      (trunk.body as Body).setVelocityX(-this.speed);
      this.addObstacle(x, GROUND_Y - 65, 110, 50, 0x3f7d3a);
      this.hint('branch', 'Swipe down to slide under!');
    }
    if (Math.random() < SPAWN.treatChance) this.spawnTreats(x + 220);

    // Gaps grow with speed so the game stays fair as it speeds up
    const scale = this.speed / SPEED.start;
    this.nextSpawnIn = Phaser.Math.Between(SPAWN.minGap, SPAWN.maxGap) * scale;
  }

  private addObstacle(x: number, y: number, w: number, h: number, color: number): void {
    const r = this.add.rectangle(x, y, w, h, color);
    this.obstacles.add(r);
    const body = r.body as Body;
    body.setAllowGravity(false);
    body.setImmovable(true);
    body.setVelocityX(-this.speed);
  }

  private spawnTreats(x: number): void {
    const high = Math.random() < 0.5;
    for (let i = 0; i < 4; i++) {
      const y = high ? GROUND_Y - 120 - Math.sin((i / 3) * Math.PI) * 50 : GROUND_Y - 30;
      const t = this.add.rectangle(x + i * 45, y, 16, 16, 0xf2c14e);
      t.setStrokeStyle(2, 0xa47a12);
      this.treats.add(t);
      const body = t.body as Body;
      body.setAllowGravity(false);
      body.setVelocityX(-this.speed);
    }
  }

  private collectTreat(t: Rect): void {
    if (!t.active) return;
    t.destroy();
    this.treatCount += 1;
  }

  // ---------- Slide ----------

  private startSlide(): void {
    if (!this.sliding) {
      this.sliding = true;
      this.setPetHeight(PET.slideHeight);
    }
    this.slideTimer?.remove();
    this.slideTimer = this.time.delayedCall(PET.slideMs, () => this.stopSlide());
  }

  private stopSlide(): void {
    this.slideTimer?.remove();
    if (!this.sliding) return;
    this.sliding = false;
    this.setPetHeight(PET.height);
  }

  private setPetHeight(h: number): void {
    const bottom = this.petBody.bottom;
    this.pet.setSize(PET.width, h);
    this.petBody.setSize(PET.width, h);
    this.pet.y = bottom - h / 2;
    this.petBody.updateFromGameObject();
  }

  // ---------- Squirrel distraction ----------

  private scheduleSquirrel(delayMs: number): void {
    this.squirrelTimer?.remove();
    this.squirrelTimer = this.time.delayedCall(delayMs, () => this.spawnSquirrel());
  }

  private spawnSquirrel(): void {
    if (this.state !== 'playing') return;
    // A squirrel dashes across the trail ahead of the pet
    this.squirrel?.destroy();
    const sq = this.add.rectangle(GAME_WIDTH + 30, GROUND_Y - 12, 34, 20, 0x7d6b5d).setDepth(1);
    sq.setStrokeStyle(2, 0x4b3f36);
    this.squirrel = sq;
    // It scampers along the trail toward and past your pet, in little hops
    this.tweens.add({
      targets: sq,
      x: -60,
      duration: 2400,
      onComplete: () => sq.destroy(),
    });
    this.tweens.add({ targets: sq, y: GROUND_Y - 30, duration: 160, yoyo: true, repeat: 7, ease: 'Sine.easeOut' });

    this.distracted = true;
    this.alertText.setVisible(true);
    this.pet.setFillStyle(0xc9884f);
    this.distractionTimer?.remove();
    this.distractionTimer = this.time.delayedCall(SQUIRREL.graceMs, () => {
      if (this.distracted) {
        this.chasing = true;
        this.toast('Squirrel! Swipe up!', '#d6402b');
      }
    });

    this.scheduleSquirrel(Phaser.Math.Between(SQUIRREL.minEveryMs, SQUIRREL.maxEveryMs));
  }

  private callBack(): void {
    const quick = this.distracted && !this.chasing;
    this.distracted = false;
    this.chasing = false;
    this.returning = true;
    this.distractionTimer?.remove();
    this.alertText.setVisible(false);
    this.pet.setFillStyle(0xa86b3c);
    if (quick) {
      this.bonus += SQUIRREL.focusBonus;
      this.toast(`Good focus! +${SQUIRREL.focusBonus}`, '#1f6f2a');
    } else {
      this.toast('Here, pup!', '#1f6f2a');
    }
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
  }

  /** Shows a one-time tip the first time each obstacle type appears in a run. */
  private hint(key: string, text: string): void {
    if (this.shownHints.has(key)) return;
    this.shownHints.add(key);
    this.toast(text, '#1d2b1f');
  }

  private toast(text: string, color: string): void {
    this.toastText.setText(text).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 700, duration: 500 });
  }

  private drawBackground(): void {
    // Simple hills and a sun, placeholders for the Backyard world art
    this.add.circle(820, 90, 44, 0xffe08a);
    this.add.ellipse(200, GROUND_Y + 10, 700, 220, 0x9fd88c);
    this.add.ellipse(760, GROUND_Y + 20, 800, 260, 0x8ccd7a);
  }
}

function loadBest(): number {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Storage can be blocked (private mode); the best score just won't persist.
  }
}
