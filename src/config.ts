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
  slideMs: 900,
};

export const SPEED = {
  start: 360, // pixels per second
  max: 900,
  gainPerSecond: 9,
};

export const SPAWN = {
  minGap: 420, // pixels of ground between obstacles at start speed
  maxGap: 860,
  treatChance: 0.6,
};

export const SQUIRREL = {
  firstAfterMs: 7000,
  minEveryMs: 11000,
  maxEveryMs: 18000,
  graceMs: 900, // time to call your pet back before it starts chasing
  driftSpeed: 70, // how fast the pet drifts back while chasing
  loseX: 50, // if the pet drifts this far left, the run ends
  focusBonus: 50,
};

export const SCORE = {
  treat: 10,
  pixelsPerMeter: 40,
};
