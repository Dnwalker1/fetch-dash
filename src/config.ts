// All the numbers that shape how the game feels live here,
// so they are easy to tune while play-testing.

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;
export const GROUND_Y = 440; // top of the ground

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
  chaseWarnMs: 900,
  chaseSpeedFactor: 0.5, // the run slows to this share of full speed
  chaseDriftSpeed: 90, // how fast the pet runs back toward the squirrel
  loseX: 50, // if the pet gets this far back, the run ends
  // Bird or den hole out of reach: the pet stops to stare and slows down
  gawkWarnMs: 700,
  gawkSpeedFactor: 0.6,
  gawkMaxMs: 5000, // after this the pet loses interest on its own (no bonus)
};

export const SCORE = {
  treat: 10,
  pixelsPerMeter: 40,
};
