import Phaser from 'phaser';
import { makeTextures } from '../art/textures';
import * as sfx from '../audio/sfx';
import { PALETTES, SIZE_SCALE, hasSavedPet, loadPet, makePetTextures, petKey, savePet, type PetChoice, type Size } from '../art/pets';
import { DISTRACTION, GAME_HEIGHT, GAME_WIDTH, GROUND_Y, LEVEL, PET, SCORE, SPAWN, SPEED } from '../config';

type State = 'ready' | 'playing' | 'over';
type Rect = Phaser.GameObjects.Rectangle;
type Img = Phaser.GameObjects.Image;
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
  private petSprite!: Phaser.GameObjects.Sprite;
  private choice!: PetChoice;
  private petW = PET.width;
  private petH = PET.height;
  private picker?: Phaser.GameObjects.Container;
  private startedAt = 0;
  private uiTap = false; // set when a tap lands on a button, so it doesn't also jump or start
  private changePetBtn?: Phaser.GameObjects.Container;
  private wasOnGround = true;
  private dustTimer = 0;
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

  create(data?: { quickStart?: boolean }): void {
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
    this.layers = [];
    this.shownHints = new Set<string>();

    makeTextures(this);
    this.makeAnimations();
    this.choice = loadPet();
    makePetTextures(this, this.choice);
    this.drawBackground();

    // Ground (static physics body the pet stands on; the art is a scrolling tile)
    const ground = this.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 50, GAME_WIDTH, 100, 0x6fbf5a).setVisible(false);
    this.physics.add.existing(ground, true);
    this.addLayer('ground', GROUND_Y, 100, 1);

    // Pet: an invisible box does the physics, and the dog sprite is drawn on top of it
    this.pet = this.add.rectangle(PET.homeX, GROUND_Y - PET.height / 2, PET.width, PET.height, PET_COLOR);
    this.pet.setVisible(false);
    this.physics.add.existing(this.pet);
    this.petBody = this.pet.body as Body;
    this.petBody.setCollideWorldBounds(false);
    this.physics.add.collider(this.pet, ground);
    this.petSprite = this.add.sprite(PET.homeX, GROUND_Y, `${petKey(this.choice)}-run-0`).setOrigin(0.5, 1).setDepth(2);
    this.applyPet();

    this.obstacles = this.physics.add.group({ allowGravity: false, immovable: true });
    this.treats = this.physics.add.group({ allowGravity: false });
    this.decor = this.physics.add.group({ allowGravity: false });
    this.physics.add.overlap(this.pet, this.obstacles, () => this.endRun('Bonk!'));
    this.physics.add.overlap(this.pet, this.treats, (_p, t) => this.collectTreat(t as Img));

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

    // First visit: show the full pet picker. After that (or after a run),
    // go straight to "Tap to run" with a small Change pet button.
    if (data?.quickStart || hasSavedPet()) this.showQuickStart();
    else this.buildPicker();
    this.updateHud();
    this.updatePetSprite();
    this.addMuteButton();

    this.setupInput();
  }

  // ---------- Input ----------

  private setupInput(): void {
    const keys = this.input.keyboard;
    keys?.on('keydown-SPACE', () => (this.state === 'ready' ? this.startRun() : this.onTap()));
    this.downKey = keys?.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
    keys?.on('keydown-DOWN', () => this.onSwipeDown());
    keys?.on('keydown-UP', () => this.onSwipeUp());
    keys?.on('keydown', () => sfx.unlock());

    // Touch and mouse are read straight from the page, in screen pixels.
    // Listening on the whole window means a swipe works anywhere on the
    // screen (not only on the game canvas), and preventDefault stops the
    // browser or the app around the game from scrolling instead.
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
    if (this.uiTap) {
      this.uiTap = false;
      return;
    }
    if (this.state === 'ready') {
      if (!this.picker) this.startRun();
      return;
    }
    if (this.time.now - this.startedAt < 300) return; // the tap that pressed Start
    if (this.state === 'over') return this.restart();
    if (this.chasing) {
      // A pet running the wrong way doesn't listen yet, but remember the jump
      // so it happens the moment the pet is called back.
      this.pendingMove = { kind: 'jump', at: this.time.now };
      return;
    }
    if (this.petBody.blocked.down || this.petBody.touching.down) {
      this.stopSlide();
      this.petBody.setVelocityY(PET.jumpVelocity);
      sfx.jump();
    }
  }

  private onSwipeDown(): void {
    if (this.state !== 'playing') return;
    if (this.chasing) {
      this.pendingMove = { kind: 'slide', at: this.time.now };
      return;
    }
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
    this.startedAt = this.time.now;
    savePet(this.choice);
    this.centerText.setText('');
    this.picker?.destroy();
    this.picker = undefined;
    this.changePetBtn?.destroy();
    this.changePetBtn = undefined;
    this.scheduleDistraction(DISTRACTION.firstAfterMs);
  }

  private endRun(reason: string, won = false): void {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.physics.pause();
    // Freeze what is moving now, but leave the tween manager running so the
    // finish effects (confetti) can still animate.
    this.tweens.getTweens().forEach((t) => t.pause());
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setAlpha(0);
    this.scheduleTimer?.remove();
    this.distractionTimer?.remove();
    this.alertText.setVisible(false);
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
    this.scene.restart({ quickStart: true });
  }

  // ---------- Main loop ----------

  update(_time: number, deltaMs: number): void {
    this.alertText.setPosition(this.pet.x, this.pet.y - 62);
    this.updatePetSprite();
    if (this.state !== 'playing') return;
    const dt = deltaMs / 1000;

    this.baseSpeed = Math.min(SPEED.max, this.baseSpeed + SPEED.gainPerSecond * dt);
    const dx = this.speed * dt;
    this.distancePx += dx;

    // Scroll the background layers; farther layers move slower
    for (const l of this.layers) l.tile.tilePositionX += dx * l.factor;

    // Keep moving things in step with the current speed
    for (const g of [this.obstacles, this.treats, this.decor]) {
      g.children.each((c) => {
        const r = c as Img;
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

    if (this.sliding) {
      this.slideLeftPx -= dx;
      if (this.slideLeftPx <= 0) this.stopSlide();
    }

    this.updatePetPosition();

    // Falling off the bottom should never happen, but just in case
    if (this.pet.y > GAME_HEIGHT + 100) this.endRun('Oops!');

    this.updateHud();
  }

  private updatePetPosition(): void {
    if (this.chasing) {
      this.petBody.setVelocityX(-DISTRACTION.chaseDriftSpeed);
      if (this.pet.x <= DISTRACTION.loseX) this.endRun(this.choice.species === 'cat' ? 'Ran off after the bird!' : 'Ran off after the squirrel!');
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

  /** Keeps the dog sprite on its physics box and picks the right pose. */
  private updatePetSprite(): void {
    const sp = this.petSprite;
    sp.setPosition(this.pet.x, this.pet.y + this.pet.height / 2);
    if (this.state !== 'playing') return;
    const d = this.distraction;
    sp.setFlipX(d?.kind === 'chase' && d.active); // turned around, after the squirrel
    sp.setAngle(d?.kind === 'gawk' && d.active ? -12 : 0); // looking up at the bird or den
    const onGround = this.petBody.blocked.down || this.petBody.touching.down;
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
      sp.anims.timeScale = this.speed / SPEED.start;
    }
  }

  // ---------- Obstacles, treats and the ball ----------

  private spawnNext(): void {
    const roll = Math.random();
    const x = GAME_WIDTH + 60;
    if (roll < 0.4) {
      this.addObstacle(x, GROUND_Y - 25, 'fence'); // fence: jump
      this.hint('fence', 'Tap to jump!');
    } else if (roll < 0.7) {
      this.addObstacle(x, GROUND_Y - 6, 'puddle'); // puddle: jump
      this.hint('puddle', 'Tap to jump the puddle!');
    } else {
      // Low branch hanging from a tree: slide under it
      this.addDecor(this.add.image(x + 40, (GROUND_Y - 75) / 2, 'trunk'));
      this.addDecor(this.add.image(x + 40, 40, 'canopy'));
      this.addObstacle(x, GROUND_Y - 65, 'branch');
      this.hint('branch', 'Swipe down to slide under!');
    }
    if (Math.random() < SPAWN.treatChance) this.spawnTreats(x + 220);

    // Gaps grow with speed so the game stays fair as it speeds up
    const scale = this.baseSpeed / SPEED.start;
    this.nextSpawnIn = Phaser.Math.Between(SPAWN.minGap, SPAWN.maxGap) * scale;
  }

  private addDecor(img: Img): void {
    this.decor.add(img);
    (img.body as Body).setVelocityX(-this.speed);
  }

  private addObstacle(x: number, y: number, key: string): void {
    const r = this.add.image(x, y, key).setDepth(1);
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
      const t = this.add.image(x + i * 45, y, this.choice.species === 'cat' ? 'fish' : 'bone').setDepth(1);
      this.treats.add(t);
      const body = t.body as Body;
      body.setAllowGravity(false);
      body.setVelocityX(-this.speed);
    }
  }

  /** The thrown ball waits on the trail; reaching it finishes the level. */
  private spawnBall(remainingPx: number): void {
    this.ballSpawned = true;
    this.addDecor(this.add.image(PET.homeX + this.petW / 2 + remainingPx, GROUND_Y - 14, 'ball').setDepth(1));
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
        const cat = this.choice.species === 'cat';
        if (Math.random() < DISTRACTION.chaseChance) this.startChase();
        else if (Math.random() < 0.5) this.startGawk('bird');
        else this.startGawk(cat ? 'butterfly' : 'den');
      }
      this.scheduleDistraction(Phaser.Math.Between(DISTRACTION.minEveryMs, DISTRACTION.maxEveryMs));
    });
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

  /** Something on the trail dashes past the pet the wrong way: a squirrel for dogs, a bird for cats. */
  private startChase(): void {
    const cat = this.choice.species === 'cat';
    const sq = cat
      ? this.add.sprite(GAME_WIDTH + 30, GROUND_Y - 14, 'bird-1').setDepth(1).play('bird-flap')
      : this.add.image(GAME_WIDTH + 30, GROUND_Y - 16, 'squirrel').setDepth(1);
    // Fast enough that it has just dashed past the pet when the warning ends
    this.tweens.add({ targets: sq, x: -60, duration: 1300, onComplete: () => sq.destroy() });
    this.tweens.add({ targets: sq, y: GROUND_Y - 34, duration: 130, yoyo: true, repeat: 4, ease: 'Sine.easeOut' });

    this.warn('chase', '!', DISTRACTION.chaseWarnMs, () => {
      this.setSpeedFactor(DISTRACTION.chaseSpeedFactor, 300);
      this.toast(cat ? 'Bird! Swipe up!' : 'Squirrel! Swipe up!', '#d6402b');
      this.petSound(2);
      this.hint('chase', 'Your pet turned around! Swipe up to call it back.');
    });
  }

  /** Something out of reach: a bird in the sky or a critter in a den hole. */
  private startGawk(what: 'bird' | 'den' | 'butterfly'): void {
    if (what === 'butterfly') {
      const b = this.add.sprite(GAME_WIDTH + 30, 300, 'butterfly-0').setDepth(1).setScale(1.3);
      b.play('butterfly-flap');
      this.tweens.add({ targets: b, x: -60, duration: 5000, onComplete: () => b.destroy() });
      this.tweens.add({ targets: b, y: 250, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else if (what === 'bird') {
      const bird = this.add.sprite(GAME_WIDTH + 40, 230, 'bird-0').setDepth(1).setScale(1.3);
      bird.play('bird-flap');
      this.tweens.add({ targets: bird, x: -60, duration: 4200, onComplete: () => bird.destroy() });
      this.tweens.add({ targets: bird, y: 200, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      // A den hole on the hillside, drifting by slower than the trail (it's farther away)
      const den = this.add.ellipse(GAME_WIDTH + 60, GROUND_Y - 48, 70, 30, 0x3a2a1a).setDepth(0.5);
      const critter = this.add.image(GAME_WIDTH + 60, GROUND_Y - 58, 'gopher').setDepth(0.6);
      this.tweens.add({ targets: [den, critter], x: -80, duration: 6000, onComplete: () => (den.destroy(), critter.destroy()) });
      this.tweens.add({ targets: critter, y: GROUND_Y - 84, duration: 350, yoyo: true, hold: 500, repeat: 5, delay: 300 });
    }

    this.warn('gawk', '?', DISTRACTION.gawkWarnMs, () => {
      this.setSpeedFactor(DISTRACTION.gawkSpeedFactor, 500);
      const msg = { bird: 'Bird! Swipe up!', den: 'Something in that hole! Swipe up!', butterfly: 'Butterfly! Swipe up!' };
      this.toast(msg[what], '#d6402b');
      this.petSound(1);
      // Eventually the pet loses interest by itself, but you lose the time
      this.distractionTimer = this.time.delayedCall(DISTRACTION.gawkMaxMs, () => this.clearDistraction());
    });
  }

  /** Show the warning, then let the distraction take over if the player doesn't act. */
  private warn(kind: DistractionKind, mark: string, warnMs: number, onGiveIn: () => void): void {
    this.distraction = { kind, active: false };
    this.alertText.setText(mark).setVisible(true);
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
    const recent = p && this.time.now - p.at < DISTRACTION.comboWindowMs;
    if (this.downKey?.isDown || (recent && p.kind === 'slide')) {
      this.startSlide();
    } else if (recent && p.kind === 'jump' && (this.petBody.blocked.down || this.petBody.touching.down)) {
      this.petBody.setVelocityY(PET.jumpVelocity);
      sfx.jump();
    }
  }

  private clearDistraction(): void {
    this.distraction = undefined;
    this.returning = true;
    this.distractionTimer?.remove();
    this.alertText.setVisible(false);
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

  // ---------- Sound and effects ----------

  private petSound(times: number): void {
    if (this.choice.species === 'cat') sfx.meow();
    else sfx.bark(times);
  }

  /** Little dust puffs kicked up behind the pet's feet. */
  private dust(count: number): void {
    const x = this.pet.x - this.petW / 3;
    const y = this.pet.y + this.pet.height / 2 - 3;
    for (let i = 0; i < count; i++) {
      const puff = this.add.circle(x + Phaser.Math.Between(-8, 8), y, Phaser.Math.Between(3, 6), 0xd9c3a0, 0.8).setDepth(1.5);
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
        y: GROUND_Y + Phaser.Math.Between(-10, 40),
        x: piece.x + Phaser.Math.Between(-80, 80),
        angle: Phaser.Math.Between(-360, 360),
        duration: Phaser.Math.Between(1400, 2600),
        ease: 'Sine.easeIn',
      });
    }
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

  // ---------- Pet picker (start screen) ----------

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

  private choose(change: Partial<PetChoice>): void {
    this.choice = { ...this.choice, ...change };
    savePet(this.choice);
    this.applyPet();
    this.buildPicker();
  }

  /** The quick screen between runs: "Tap to run" plus a small Change pet button. */
  private showQuickStart(): void {
    this.picker?.destroy();
    this.picker = undefined;
    this.centerText.setFontSize(30);
    this.centerText.setText('Tap to run!\n\nReach the ball at the end of the trail');
    this.changePetBtn?.destroy();
    const btn = this.add.container(GAME_WIDTH - 90, 70).setDepth(20);
    const bg = this.add
      .rectangle(0, 0, 150, 36, 0xffffff, 0.9)
      .setStrokeStyle(2, 0x3f7d3a)
      .setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => {
      this.uiTap = true;
      btn.destroy();
      this.changePetBtn = undefined;
      this.centerText.setText('');
      this.buildPicker();
    });
    btn.add(bg);
    btn.add(
      this.add
        .text(0, 0, '\u{1F43E} Change pet', { fontFamily: 'Arial, sans-serif', fontSize: '17px', fontStyle: 'bold', color: '#1d2b1f' })
        .setOrigin(0.5)
    );
    this.changePetBtn = btn;
  }

  private buildPicker(): void {
    this.picker?.destroy();
    const c = this.add.container(0, 0).setDepth(20);
    this.picker = c;
    const cx = 600;
    const text = (x: number, y: number, t: string, size: number, color = '#1d2b1f') =>
      c.add(this.add.text(x, y, t, { fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, fontStyle: 'bold', color }).setOrigin(0.5));

    c.add(this.add.rectangle(cx, 235, 560, 390, 0xffffff, 0.82).setStrokeStyle(3, 0x3f7d3a));
    text(cx, 70, 'FETCH DASH  ·  Level 1', 34);
    text(cx, 106, 'Reach the ball at the end of the trail!', 18, '#3f5f3a');

    const button = (x: number, y: number, w: number, label: string, selected: boolean, onClick: () => void) => {
      const bg = this.add
        .rectangle(x, y, w, 44, selected ? 0x3f7d3a : 0xffffff)
        .setStrokeStyle(2, 0x3f7d3a)
        .setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.uiTap = true;
        onClick();
      });
      c.add(bg);
      text(x, y, label, 20, selected ? '#ffffff' : '#1d2b1f');
    };

    text(cx - 200, 155, 'Pet', 20);
    button(cx - 50, 155, 130, 'Dog', this.choice.species === 'dog', () => this.choose({ species: 'dog' }));
    button(cx + 100, 155, 130, 'Cat', this.choice.species === 'cat', () => this.choose({ species: 'cat' }));

    text(cx - 200, 213, 'Size', 20);
    (['small', 'medium', 'large'] as Size[]).forEach((size, i) => {
      const label = size[0].toUpperCase() + size.slice(1);
      button(cx - 75 + i * 125, 213, 115, label, this.choice.size === size, () => this.choose({ size }));
    });

    text(cx - 200, 271, 'Color', 20);
    Object.entries(PALETTES).forEach(([key, pal], i) => {
      const x = cx - 100 + i * 62;
      const selected = this.choice.palette === key;
      const dot = this.add
        .circle(x, 271, 20, pal.fur)
        .setStrokeStyle(selected ? 5 : 2, selected ? 0x3f7d3a : 0x7a7a7a)
        .setInteractive({ useHandCursor: true });
      dot.on('pointerdown', () => {
        this.uiTap = true;
        this.choose({ palette: key });
      });
      c.add(dot);
    });

    button(cx, 340, 240, 'Start  \u25B6', true, () => this.startRun());
    text(cx, 395, 'Tap / Space: jump   ·   Swipe down: slide   ·   Swipe up: stay on task', 15, '#3f5f3a');
  }

  private drawBackground(): void {
    const sky = this.add.graphics();
    sky.fillGradientStyle(0x8fd3ff, 0x8fd3ff, 0xdff3ff, 0xdff3ff, 1);
    sky.fillRect(0, 0, GAME_WIDTH, GROUND_Y);
    this.add.circle(820, 90, 44, 0xffe08a);
    this.add.circle(820, 90, 58, 0xffe08a, 0.25);
    this.addLayer('clouds', 20, 160, 0.08);
    this.addLayer('hills', GROUND_Y - 220, 220, 0.2);
    this.addLayer('bushes', GROUND_Y - 150, 150, 0.45);
  }

  private addLayer(key: string, y: number, h: number, factor: number): void {
    const tile = this.add.tileSprite(0, y, GAME_WIDTH, h, key).setOrigin(0, 0);
    this.layers.push({ tile, factor });
  }

  private makeAnimations(): void {
    if (!this.anims.exists('dog-run')) {
      this.anims.create({
        key: 'dog-run',
        frames: ['dog-run-0', 'dog-run-1', 'dog-run-2', 'dog-run-1'].map((key) => ({ key })),
        frameRate: 12,
        repeat: -1,
      });
    }
    if (!this.anims.exists('butterfly-flap')) {
      this.anims.create({ key: 'butterfly-flap', frames: [{ key: 'butterfly-0' }, { key: 'butterfly-1' }], frameRate: 10, repeat: -1 });
    }
    if (!this.anims.exists('bird-flap')) {
      this.anims.create({ key: 'bird-flap', frames: [{ key: 'bird-0' }, { key: 'bird-1' }], frameRate: 8, repeat: -1 });
    }
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
