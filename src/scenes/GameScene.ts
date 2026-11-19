import Phaser from 'phaser';
import { DISTRACTION, GAME_HEIGHT, GAME_WIDTH, GROUND_Y, LEVEL, PET, SCORE, SPAWN, SPEED } from '../config';

type State = 'ready' | 'playing' | 'over';
type Rect = Phaser.GameObjects.Rectangle;
type Body = Phaser.Physics.Arcade.Body;

/**
 * chase: a squirrel on the trail. The pet turns around and runs after it,
 *        and the run ends if it gets too far back.
 * gawk:  a bird in the sky or a critter in a den hole, out of reach.
 *        The pet stops to stare and slows down, but the run goes on.
 */
type DistractionKind = 'chase' | 'gawk';
interface Distraction {
  kind: DistractionKind;
  active: boolean; // false during the short warning, true once the pet gives in
}

const BEST_KEY = 'fetch-dash-best';
const SWIPE_PX = 30; // screen pixels
const PET_COLOR = 0xa86b3c;

/**
 * Week 1 prototype: placeholder shapes only.
 * The pet runs on its own. Tap to jump, swipe down to slide,
 * swipe up to call the pet back when something distracts it.
 * Reach the ball at the end of the trail to finish Level 1.
 */
export class GameScene extends Phaser.Scene {
  private state: State = 'ready';
  private pet!: Rect;
  private petBody!: Body;
  private nose!: Rect;
  private obstacles!: Phaser.Physics.Arcade.Group;
  private treats!: Phaser.Physics.Arcade.Group;
  private decor!: Phaser.Physics.Arcade.Group;
  private shownHints = new Set<string>();

  private baseSpeed = SPEED.start; // full running speed, rises over time
  private speedFactor = 1; // drops while the pet is distracted
  private distancePx = 0;
  private treatCount = 0;
  private bonus = 0;
  private best = 0;
  private nextSpawnIn = 0;
  private ballSpawned = false;

  private sliding = false;
  private slideTimer?: Phaser.Time.TimerEvent;

  private distraction?: Distraction;
  private returning = false;
  private distractionTimer?: Phaser.Time.TimerEvent;
  private scheduleTimer?: Phaser.Time.TimerEvent;
  private alertText!: Phaser.GameObjects.Text;

  private scoreText!: Phaser.GameObjects.Text;
  private centerText!: Phaser.GameObjects.Text;
  private toastText!: Phaser.GameObjects.Text;
  private progressFill!: Rect;
  private groundStripes: Rect[] = [];

  private pointerStart?: { x: number; y: number; handled: boolean };

  constructor() {
    super('game');
  }

  private get speed(): number {
    return this.baseSpeed * this.speedFactor;
  }

  create(): void {
    this.best = loadBest();
    this.state = 'ready';
    this.baseSpeed = SPEED.start;
    this.speedFactor = 1;
    this.distancePx = 0;
    this.treatCount = 0;
    this.bonus = 0;
    this.nextSpawnIn = 600;
    this.ballSpawned = false;
    this.sliding = false;
    this.distraction = undefined;
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

    // Pet (placeholder: a brown block; the dark "nose" shows where it's looking)
    this.pet = this.add.rectangle(PET.homeX, GROUND_Y - PET.height / 2, PET.width, PET.height, PET_COLOR);
    this.pet.setStrokeStyle(3, 0x5c3a1e);
    this.physics.add.existing(this.pet);
    this.pet.setDepth(2);
    this.petBody = this.pet.body as Body;
    this.petBody.setCollideWorldBounds(false);
    this.physics.add.collider(this.pet, ground);
    this.nose = this.add.rectangle(0, 0, 12, 12, 0x2b1a0d).setDepth(3);

    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.treats = this.physics.add.group({ allowGravity: false });
    this.decor = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.pet, this.obstacles, () => this.endRun('Bonk!'));
    this.physics.add.overlap(this.pet, this.treats, (_p, t) => this.collectTreat(t as Rect));

    // HUD
    const font = { fontFamily: 'Arial, sans-serif', color: '#1d2b1f' };
    this.scoreText = this.add.text(20, 16, '', { ...font, fontSize: '24px', fontStyle: 'bold' }).setDepth(10);
    this.add.rectangle(GAME_WIDTH - 220, 30, 200, 14, 0xffffff, 0.7).setOrigin(0, 0.5).setDepth(10);
    this.progressFill = this.add.rectangle(GAME_WIDTH - 220, 30, 0, 14, 0x3f7d3a).setOrigin(0, 0.5).setDepth(10);
    this.add.circle(GAME_WIDTH - 14, 30, 10, 0xd8e65a).setStrokeStyle(2, 0x7a8a1a).setDepth(10);
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
      'FETCH DASH  ·  Level 1\n\nTap to start\n\n' +
        'Tap / Space: jump    Swipe down / Down: slide\n' +
        'Swipe up / Up: keep your pet on task\n\nReach the ball at the end of the trail!'
    );
    this.centerText.setFontSize(24);
    this.updateHud();
    this.updateNose();

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

  private get chasing(): boolean {
    return this.distraction?.kind === 'chase' && this.distraction.active;
  }

  private onTap(): void {
    if (this.state === 'ready') return this.startRun();
    if (this.state === 'over') return this.restart();
    if (this.chasing) return; // a pet running the wrong way doesn't listen to jump
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
    if (this.distraction) this.callBack();
  }

  // ---------- Run lifecycle ----------

  private startRun(): void {
    this.state = 'playing';
    this.centerText.setText('');
    this.scheduleDistraction(DISTRACTION.firstAfterMs);
  }

  private endRun(reason: string, won = false): void {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.physics.pause();
    this.tweens.pauseAll();
    this.scheduleTimer?.remove();
    this.distractionTimer?.remove();
    this.alertText.setVisible(false);
    if (!won) this.pet.setFillStyle(0x8a8a8a);

    const score = this.score();
    const newBest = score > this.best;
    if (newBest) {
      this.best = score;
      saveBest(score);
    }
    this.centerText.setFontSize(30);
    this.centerText.setText(
      `${reason}\n\nScore ${score}${newBest ? '  (new best!)' : ''}\n` +
        `${Math.min(this.meters(), LEVEL.goalMeters)} of ${LEVEL.goalMeters} m  ·  ${this.treatCount} treats\n\n` +
        (won ? 'Tap to play again' : 'Tap to run again')
    );
    this.updateHud();
  }

  private restart(): void {
    this.physics.resume();
    this.tweens.resumeAll();
    this.scene.restart();
  }

  // ---------- Main loop ----------

  update(_time: number, deltaMs: number): void {
    this.alertText.setPosition(this.pet.x, this.pet.y - 62);
    this.updateNose();
    if (this.state !== 'playing') return;
    const dt = deltaMs / 1000;

    this.baseSpeed = Math.min(SPEED.max, this.baseSpeed + SPEED.gainPerSecond * dt);
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

    const remainingPx = LEVEL.goalMeters * SCORE.pixelsPerMeter - this.distancePx;
    if (remainingPx <= 0) {
      this.endRun('You caught the ball!\nLevel 1 complete', true);
      return;
    }
    if (!this.ballSpawned && remainingPx <= GAME_WIDTH - PET.homeX) this.spawnBall(remainingPx);

    // No new obstacles in the final stretch, so the finish stays clear
    this.nextSpawnIn -= dx;
    if (this.nextSpawnIn <= 0 && remainingPx > GAME_WIDTH + 200) this.spawnNext();

    this.updatePetPosition();

    // Falling off the bottom should never happen, but just in case
    if (this.pet.y > GAME_HEIGHT + 100) this.endRun('Oops!');

    this.updateHud();
  }

  private updatePetPosition(): void {
    if (this.chasing) {
      this.petBody.setVelocityX(-DISTRACTION.chaseDriftSpeed);
      if (this.pet.x <= DISTRACTION.loseX) this.endRun('Ran off after the squirrel!');
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

  /** The nose shows where the pet is looking: ahead, back at a squirrel, or up. */
  private updateNose(): void {
    const halfW = this.pet.width / 2;
    const halfH = this.pet.height / 2;
    const d = this.distraction;
    if (d?.active && d.kind === 'chase') {
      this.nose.setPosition(this.pet.x - halfW, this.pet.y - halfH + 14);
    } else if (d?.active && d.kind === 'gawk') {
      this.nose.setPosition(this.pet.x + halfW - 10, this.pet.y - halfH);
    } else {
      this.nose.setPosition(this.pet.x + halfW, this.pet.y - halfH + 14);
    }
  }

  // ---------- Obstacles, treats and the ball ----------

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
    const scale = this.baseSpeed / SPEED.start;
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

  /** The thrown ball waits on the trail; reaching it finishes the level. */
  private spawnBall(remainingPx: number): void {
    this.ballSpawned = true;
    const ball = this.add.circle(PET.homeX + PET.width / 2 + remainingPx, GROUND_Y - 14, 14, 0xd8e65a);
    ball.setStrokeStyle(3, 0x7a8a1a);
    this.decor.add(ball);
    (ball.body as Body).setVelocityX(-this.speed);
    this.toast('There’s the ball!', '#1f6f2a');
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

  // ---------- Distractions ----------

  private scheduleDistraction(delayMs: number): void {
    this.scheduleTimer?.remove();
    this.scheduleTimer = this.time.delayedCall(delayMs, () => {
      if (this.state !== 'playing') return;
      if (!this.distraction) {
        if (Math.random() < DISTRACTION.chaseChance) this.startChase();
        else if (Math.random() < 0.5) this.startGawk('bird');
        else this.startGawk('den');
      }
      this.scheduleDistraction(Phaser.Math.Between(DISTRACTION.minEveryMs, DISTRACTION.maxEveryMs));
    });
  }

  /** A squirrel scampers along the trail past the pet, the wrong way. */
  private startChase(): void {
    const sq = this.add.rectangle(GAME_WIDTH + 30, GROUND_Y - 12, 34, 20, 0x7d6b5d).setDepth(1);
    sq.setStrokeStyle(2, 0x4b3f36);
    // Fast enough that it has just dashed past the pet when the warning ends
    this.tweens.add({ targets: sq, x: -60, duration: 1300, onComplete: () => sq.destroy() });
    this.tweens.add({ targets: sq, y: GROUND_Y - 30, duration: 130, yoyo: true, repeat: 4, ease: 'Sine.easeOut' });

    this.warn('chase', '!', DISTRACTION.chaseWarnMs, () => {
      this.setSpeedFactor(DISTRACTION.chaseSpeedFactor, 300);
      this.toast('Squirrel! Swipe up!', '#d6402b');
      this.hint('chase', 'Your pet turned around! Swipe up to call it back.');
    });
  }

  /** Something out of reach: a bird in the sky or a critter in a den hole. */
  private startGawk(what: 'bird' | 'den'): void {
    if (what === 'bird') {
      const bird = this.add.triangle(GAME_WIDTH + 40, 230, 0, 0, 36, 8, 0, 16, 0x3b3b5c).setDepth(1);
      this.tweens.add({ targets: bird, x: -60, duration: 4200, onComplete: () => bird.destroy() });
      this.tweens.add({ targets: bird, y: 205, scaleY: 0.4, duration: 220, yoyo: true, repeat: -1 });
    } else {
      // A den hole on the hillside, drifting by slower than the trail (it's farther away)
      const den = this.add.ellipse(GAME_WIDTH + 60, GROUND_Y - 48, 70, 30, 0x3a2a1a).setDepth(0.5);
      const critter = this.add.rectangle(GAME_WIDTH + 60, GROUND_Y - 56, 24, 26, 0x9a7b5c).setDepth(0.6);
      critter.setStrokeStyle(2, 0x5e4630);
      this.tweens.add({ targets: [den, critter], x: -80, duration: 6000, onComplete: () => (den.destroy(), critter.destroy()) });
      this.tweens.add({ targets: critter, y: GROUND_Y - 84, duration: 350, yoyo: true, hold: 500, repeat: 5, delay: 300 });
    }

    this.warn('gawk', '?', DISTRACTION.gawkWarnMs, () => {
      this.setSpeedFactor(DISTRACTION.gawkSpeedFactor, 500);
      this.toast(what === 'bird' ? 'Bird! Swipe up!' : 'Something in that hole! Swipe up!', '#d6402b');
      // Eventually the pet loses interest by itself, but you lose the time
      this.distractionTimer = this.time.delayedCall(DISTRACTION.gawkMaxMs, () => this.clearDistraction());
    });
  }

  /** Show the warning, then let the distraction take over if the player doesn't act. */
  private warn(kind: DistractionKind, mark: string, warnMs: number, onGiveIn: () => void): void {
    this.distraction = { kind, active: false };
    this.alertText.setText(mark).setVisible(true);
    this.pet.setFillStyle(0xc9884f);
    this.distractionTimer?.remove();
    this.distractionTimer = this.time.delayedCall(warnMs, () => {
      if (!this.distraction || this.state !== 'playing') return;
      this.distraction.active = true;
      onGiveIn();
    });
  }

  private callBack(): void {
    const quick = this.distraction && !this.distraction.active;
    this.clearDistraction();
    if (quick) {
      this.bonus += DISTRACTION.focusBonus;
      this.toast(`Good focus! +${DISTRACTION.focusBonus}`, '#1f6f2a');
    } else {
      this.toast('Here, pup!', '#1f6f2a');
    }
  }

  private clearDistraction(): void {
    this.distraction = undefined;
    this.returning = true;
    this.distractionTimer?.remove();
    this.alertText.setVisible(false);
    this.pet.setFillStyle(PET_COLOR);
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
    this.progressFill.width = 200 * Math.min(1, this.meters() / LEVEL.goalMeters);
  }

  /** Shows a one-time tip the first time each thing appears in a run. */
  private hint(key: string, text: string): void {
    if (this.shownHints.has(key)) return;
    this.shownHints.add(key);
    this.toast(text, '#1d2b1f');
  }

  private toast(text: string, color: string): void {
    this.toastText.setText(text).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 900, duration: 500 });
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
