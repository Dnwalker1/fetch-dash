// All the numbers that shape how the game feels live here,
// so they are easy to tune while play-testing.

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const GROUND_Y = 440; // top of the ground

/**
 * Canvas pixels per game pixel. The world stays 960x540 and the camera zooms
 * in, so phones and big windows get a sharp picture instead of a stretched
 * one. Capped at 2, since more costs a lot of fill-rate on mid-range phones.
 * Add ?rs=1 or ?rs=2 to the page address to force one while testing.
 */
export const RENDER_SCALE = ((): number => {
  if (typeof window === 'undefined') return 1;
  const forced = Number(new URLSearchParams(window.location.search).get('rs'));
  if (forced === 1 || forced === 2) return forced;
  const fit = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
  return fit * (window.devicePixelRatio || 1) > 1.1 ? 2 : 1;
})();

export const PET = {
  homeX: 220,
  width: 56,
  height: 56,
  slideHeight: 26,
  jumpVelocity: -850,
  // A slide covers a set stretch of trail, so it still clears a branch
  // when a distraction has slowed the run down.
  slideDistance: 320,
};

export const SPEED = {
  start: 300, // pixels per second
  max: 750,
  gainPerSecond: 6,
};

export const LEVEL = {
  goalMeters: 600, // catch the ball here to finish Level 1 (about a minute)
};

export const SPAWN = {
  minGap: 420, // pixels of ground between obstacles at start speed
  maxGap: 860,
  treatChance: 0.6,
};

export const DISTRACTION = {
  firstAfterMs: 6000,
  minEveryMs: 8000,
  maxEveryMs: 13000,
  chaseChance: 0.5, // the rest are out-of-reach distractions (bird, den hole)
  focusBonus: 50, // for calling your pet back before it gives in
  // Squirrel on the trail: the pet turns around and chases it
  chaseWarnMs: 1100,
  chaseSpeedFactor: 0.5, // the run slows to this share of full speed
  chaseDriftSpeed: 90, // how fast the pet runs back toward the squirrel
  loseX: 50, // if the pet gets this far back, the run ends
  // Bird or den hole out of reach: the pet stops to stare and slows down
  gawkWarnMs: 1100,
  gawkSpeedFactor: 0.6,
  comboWindowMs: 600, // a slide/jump pressed this soon before the call-back still happens
  clearAheadMs: 1200, // no new distraction if an obstacle arrives within this time
  retryMs: 400,
  gawkMaxMs: 5000, // after this the pet loses interest on its own (no bonus)
};

/** Hold to stop: a finger held down (or the left arrow) brings the pet to a stop. */
export const BRAKE = {
  holdMs: 220, // a press held this long without swiping is a hold, not a tap (a tap jumps)
  stopS: 0.3, // seconds from full speed to a stop
  goS: 0.45, // seconds back up to full speed after letting go
  standSpeed: 25, // below this (px/s) the pet stands still instead of running in place
};

/** A neighbor by the trail holding out a treat (levels with 'person' in gawk). */
export const GREET = {
  reach: 110, // how close (px) the pet has to stop to the neighbor
  stopSpeed: 75, // and how slow it has to be going
  creepSpeed: 70, // stopped short of them, the pet walks up at this speed (px/s)
  bonus: 75,
};

/**
 * Climbing sections (levels with `climb`): ledges in steps up to a ridge.
 * Positions and widths are in px at 300 px/s and stretch with the run's speed.
 * h is the ledge top's height above the ground (the hills flatten out under a section);
 * a jump rises about 180 px.
 */
export const CLIMB = {
  steps: [
    { dx: 0, w: 220, h: 90 },
    { dx: 330, w: 220, h: 150 },
    { dx: 660, w: 440, h: 205 },
    { dx: 1240, w: 380, h: 205 },
  ],
  treatsAbove: 190, // steps at least this high carry treats
  lowRoad: [0.45, 0.82], // obstacles on the trail under the ridge, as a share of the section
  goldenBonus: 100,
  clearEndPx: 3200, // no climb this close to the finish
  flatRamp: 260, // px over which the hills ease flat before a section and back after it
};

/**
 * Dig-and-tunnel sections (levels with `dig`): a dig spot on the trail; swipe
 * down on it to dig into a tunnel with stones to jump, roots to slide under and
 * buried bones, then pop back out. Lengths are in px at 300 px/s and stretch
 * with the run's speed.
 */
export const TUNNEL = {
  digReach: 60, // how close (px) to the spot the slide has to start
  lengthPx: 2600, // how long the tunnel runs
  clearEndPx: 700, // nothing new in the tunnel's last stretch, so you pop out onto a clear trail
  gap: [380, 620] as [number, number], // between things in the tunnel
  goldenBonus: 100,
};

export const SCORE = {
  treat: 10,
  pixelsPerMeter: 40,
};

/**
 * The Backyard Toss bonus round (src/scenes/BonusScene.ts): a lawn seen from
 * above at an angle. Things farther up the screen are farther away, so they
 * are drawn smaller and move more slowly (see depthScale there).
 */
export const BONUS = {
  horizonY: 120, // where the lawn meets the sky
  farScale: 0.45, // size of things at the horizon...
  nearScale: 1.15, // ...and at the bottom of the screen
  // The lawn is a trapezoid: half its width where it meets the back fence,
  // and half its width at the bottom of the screen
  fenceY: 132,
  halfWidthFar: 235,
  halfWidthNear: 560,
  // Where the pet and the balls can go (the back fence and the near edge)
  fieldTop: 150,
  fieldBottom: 522,
  ySquash: 0.8, // up-and-down moves cover less screen than sideways ones, which reads as depth
  roundSeconds: 60,
  ring: { x: 480, y: 488, rx: 66, ry: 24 }, // the glowing spot to bring the ball back to
  // The pet (speeds in game px per second at full size, shrunk with depth)
  petSpeed: 460,
  petAccel: 1500,
  autoChaseMs: 650, // after a throw the pet runs after the ball on its own this long
  grabReach: 36, // how close the pet has to be to pick up a ball
  grabHeight: 70, // a ball higher than this sails over the pet's head (it leaps for one lower)
  // The ball: its height is worked out by hand (z, with this gravity)
  gravity: 1400,
  throwSpeed: [120, 420] as [number, number], // along the ground, weakest to strongest throw
  throwLift: [500, 810] as [number, number], // straight up
  // bounce: share of its fall speed it bounces back up with; grip: share of its speed
  // along the ground it keeps at each bounce; friction: how fast it stops rolling
  dog: { bounce: 0.45, grip: 0.65, friction: 520, bounces: 3 },
  cat: { bounce: 0.25, grip: 0.85, friction: 200, bounces: 2 }, // yarn rolls farther and bounces less
  // Treats
  perReturn: 3,
  airCatch: 3,
  streak: { length: 3, bonus: 5 },
  piles: 6, // treat piles on the lawn at a time
  farShare: 0.7, // share of piles in the far half
  multiAfter: [3, 6], // returns before throws launch 2 balls, then 3
  // A sprinkler that turns on now and then and pushes the ball along
  sprinkler: { x: 655, y: 285, reach: 120, push: 520, onMs: 3200, offMs: [5000, 8000] as [number, number] },
};
