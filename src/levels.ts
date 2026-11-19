import { GROUND_Y } from './config';

/**
 * The levels. Each one is a trail with its own look, length, speed,
 * obstacles and critters. To add a level, add an entry here (and any new
 * art in src/art/levelArt.ts).
 */

export type ObstacleKind =
  | 'fence' | 'puddle' | 'branch' | 'log' | 'rock' | 'sandcastle' | 'driftwood' | 'umbrella'
  | 'trashcan' | 'hydrant' | 'sign' | 'awning' | 'stump' | 'creek' | 'snowman' | 'sled' | 'snowbranch';

export type ChaserKind = 'squirrel' | 'rabbit' | 'crab' | 'bird' | 'cat' | 'dog' | 'frog' | 'fox' | 'cardinal';
export type GawkKind = 'bird' | 'den' | 'butterfly' | 'gull' | 'pigeon' | 'person' | 'duck' | 'owl';

/** One scrolling background layer: texture, height in px, scroll speed vs. the trail. */
export interface Layer {
  key: string;
  h: number;
  factor: number;
  tint?: number;
  /** Raise the layer this many px above the usual horizon (for hilly levels). */
  lift?: number;
}

export interface Theme {
  skyTop: number;
  skyBottom: number;
  /** The sun (or the moon on a night level). Leave out for an overcast sky. */
  sun?: { x: number; y: number; r: number; color: number; glow: number };
  /** Background layers, far to near. A haze goes between the first and the rest. */
  layers: Layer[];
  /** Sun reflection on the water (the beach). */
  sunGlint?: boolean;
  /** How strong the slow-turning sun rays are (0 = none). */
  raysAlpha: number;
  cloudsAlpha: number;
  cloudTint?: number;
  /** Stars twinkle in the sky. */
  night?: boolean;
  weather?: 'rain' | 'snow';
  grass: number;
  grassDark: number;
  dirt: number;
  dirtDark: number;
  /** Tint used for the pale "sky haze" over the farthest layer. */
  haze: number;
  /** Little marks drawn along the ground. 'street' draws a sidewalk and road instead of a dirt path. */
  tufts: 'grass' | 'sand' | 'street' | 'snow';
}

export interface LevelDef {
  id: number;
  name: string;
  tagline: string;
  goalMeters: number;
  speed: { start: number; max: number; gainPerSecond: number };
  /** Obstacles and how often each one shows up (weights). */
  obstacles: Partial<Record<ObstacleKind, number>>;
  /** Height of the hills in px (0 = flat) and how long one hill is. */
  hills: { height: number; length: number };
  /** What dashes past on the trail: dogs chase this... */
  dogChaser: ChaserKind;
  /** ...and cats chase this. */
  catChaser: ChaserKind;
  /** Out-of-reach distractions. */
  gawk: GawkKind[];
  theme: Theme;
}

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: 'Park Trail',
    tagline: 'A sunny run through the park',
    goalMeters: 600,
    speed: { start: 300, max: 750, gainPerSecond: 6 },
    obstacles: { fence: 4, puddle: 3, branch: 3 },
    hills: { height: 0, length: 1 },
    dogChaser: 'squirrel',
    catChaser: 'bird',
    gawk: ['bird', 'den', 'butterfly'],
    theme: {
      skyTop: 0x8fd3ff,
      skyBottom: 0xdff3ff,
      sun: { x: 820, y: 90, r: 44, color: 0xffe08a, glow: 0xffe08a },
      layers: [
        { key: 'hills', h: 220, factor: 0.2 },
        { key: 'bushes', h: 150, factor: 0.45 },
      ],
      raysAlpha: 0.4,
      cloudsAlpha: 1,
      grass: 0x6fbf5a,
      grassDark: 0x58a446,
      dirt: 0xb98b5a,
      dirtDark: 0xa77b4d,
      haze: 0xdff3ff,
      tufts: 'grass',
    },
  },
  {
    id: 2,
    name: 'Hilltop Trail',
    tagline: 'Up and down the rolling hills',
    goalMeters: 800,
    speed: { start: 310, max: 760, gainPerSecond: 6.5 },
    obstacles: { log: 3, rock: 3, branch: 3, fence: 1 },
    hills: { height: 70, length: 1500 },
    dogChaser: 'rabbit',
    catChaser: 'bird',
    gawk: ['bird', 'den', 'butterfly'],
    theme: {
      skyTop: 0x6fb8f0,
      skyBottom: 0xfbe9c8,
      sun: { x: 760, y: 120, r: 46, color: 0xffd36b, glow: 0xffc14d },
      layers: [
        { key: 'mountains', h: 260, factor: 0.2 },
        { key: 'pines', h: 170, factor: 0.45, lift: 30 },
      ],
      raysAlpha: 0.4,
      cloudsAlpha: 1,
      grass: 0x7dbd4f,
      grassDark: 0x5f9c3a,
      dirt: 0xa77b52,
      dirtDark: 0x8d6440,
      haze: 0xf5e2c0,
      tufts: 'grass',
    },
  },
  {
    id: 3,
    name: 'Sunset Beach',
    tagline: 'Race the sunset along the sand',
    goalMeters: 1000,
    speed: { start: 320, max: 780, gainPerSecond: 7 },
    obstacles: { sandcastle: 3, driftwood: 3, umbrella: 3, puddle: 1 },
    hills: { height: 34, length: 1100 },
    dogChaser: 'crab',
    catChaser: 'crab',
    gawk: ['gull', 'butterfly'],
    theme: {
      skyTop: 0x5a4a9c,
      skyBottom: 0xffb36b,
      sun: { x: 700, y: 230, r: 62, color: 0xffd27a, glow: 0xff8a5c },
      layers: [
        { key: 'sea', h: 130, factor: 0.05 },
        { key: 'palms', h: 220, factor: 0.45, lift: 30 },
      ],
      sunGlint: true,
      raysAlpha: 0.7,
      cloudsAlpha: 0.55,
      grass: 0xf1d79a,
      grassDark: 0xe0bf78,
      dirt: 0xdcb46e,
      dirtDark: 0xc79c55,
      haze: 0xffc89a,
      tufts: 'sand',
    },
  },
  {
    id: 4,
    name: 'Main Street',
    tagline: 'Downtown at dusk, lights coming on',
    goalMeters: 1000,
    speed: { start: 330, max: 790, gainPerSecond: 7 },
    obstacles: { trashcan: 3, hydrant: 3, sign: 2, awning: 3 },
    hills: { height: 0, length: 1 },
    dogChaser: 'cat',
    catChaser: 'dog',
    gawk: ['pigeon', 'person'],
    theme: {
      skyTop: 0x3d3f7a,
      skyBottom: 0xf2a07a,
      sun: { x: 300, y: 300, r: 50, color: 0xffc27a, glow: 0xff8a5c },
      layers: [
        { key: 'town', h: 240, factor: 0.15 },
        { key: 'lamps', h: 190, factor: 0.45 },
      ],
      raysAlpha: 0.25,
      cloudsAlpha: 0.45,
      cloudTint: 0xf3c6c0,
      grass: 0xb9b4ad, // sidewalk
      grassDark: 0x8f8a84, // curb
      dirt: 0x55575d, // road
      dirtDark: 0xe8c547, // lane paint
      haze: 0xf2a07a,
      tufts: 'street',
    },
  },
  {
    id: 5,
    name: 'Rainy Riverside',
    tagline: 'Splash along the river in the rain',
    goalMeters: 1100,
    speed: { start: 340, max: 800, gainPerSecond: 7.5 },
    obstacles: { stump: 3, creek: 3, log: 2, rock: 2, branch: 3 },
    hills: { height: 40, length: 1300 },
    dogChaser: 'frog',
    catChaser: 'frog',
    gawk: ['duck', 'den'],
    theme: {
      skyTop: 0x7d8a99,
      skyBottom: 0xc9d3d9,
      layers: [
        { key: 'mountains', h: 260, factor: 0.12, tint: 0x9fb2a8 },
        { key: 'willows', h: 190, factor: 0.3, lift: 50 },
        { key: 'river', h: 80, factor: 0.45 },
      ],
      raysAlpha: 0,
      cloudsAlpha: 0.9,
      cloudTint: 0xaab4bd,
      weather: 'rain',
      grass: 0x5f9e4f,
      grassDark: 0x4a8240,
      dirt: 0x7a5a3c,
      dirtDark: 0x5f4630,
      haze: 0xc9d3d9,
      tufts: 'grass',
    },
  },
  {
    id: 6,
    name: 'Snowy Night',
    tagline: 'A moonlit dash through the snow',
    goalMeters: 1200,
    speed: { start: 350, max: 820, gainPerSecond: 8 },
    obstacles: { snowman: 3, sled: 3, snowbranch: 3, rock: 1 },
    hills: { height: 60, length: 1600 },
    dogChaser: 'fox',
    catChaser: 'cardinal',
    gawk: ['owl', 'den'],
    theme: {
      skyTop: 0x0f1a3a,
      skyBottom: 0x34477a,
      sun: { x: 760, y: 100, r: 38, color: 0xf4f1dc, glow: 0xc9d6ff },
      layers: [
        { key: 'mountains', h: 260, factor: 0.2, tint: 0x6f7fa8 },
        { key: 'snowpines', h: 190, factor: 0.45, lift: 30 },
      ],
      raysAlpha: 0,
      cloudsAlpha: 0.25,
      cloudTint: 0x9fb0d6,
      night: true,
      weather: 'snow',
      grass: 0xf4f7fb,
      grassDark: 0xcfd8e6,
      dirt: 0xdfe6f0,
      dirtDark: 0xb9c4d4,
      haze: 0x34477a,
      tufts: 'snow',
    },
  },
];

export function levelById(id: number): LevelDef {
  return LEVELS.find((l) => l.id === id) ?? LEVELS[0];
}

/** Flat ground for the first stretch and the last stretch (where the ball waits). */
const FLAT_START_PX = 700;
const FLAT_END_PX = 1300;

/**
 * Height of the ground (screen y of its top) at a point along the trail.
 * `worldX` is measured from the start of the level.
 */
export function groundYAt(level: LevelDef, worldX: number): number {
  const { height, length } = level.hills;
  if (height <= 0) return GROUND_Y;
  const endPx = level.goalMeters * 40;
  // Ease the hills in after the start and out before the finish
  const inRamp = clamp01((worldX - FLAT_START_PX) / 900);
  const outRamp = clamp01((endPx - FLAT_END_PX - worldX) / 900);
  const ramp = smooth(inRamp) * smooth(outRamp);
  const k = (Math.PI * 2) / length;
  // Two waves of different length so the hills don't repeat exactly
  const wave = 0.65 * (1 - Math.cos(worldX * k)) / 2 + 0.35 * (1 - Math.cos(worldX * k * 0.43 + 1.3)) / 2;
  return GROUND_Y - height * wave * ramp;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

// ---------- Progress: which levels are open, and the best score on each ----------

const PROGRESS_KEY = 'fetch-dash-progress';
const OLD_BEST_KEY = 'fetch-dash-best';

export interface Progress {
  unlocked: number; // highest level the player can pick
  current: number; // the level to start on
  best: Record<number, number>;
  done: number[]; // levels finished at least once
  stars: Record<number, number>; // most stars earned on each level (0-3)
}

export function loadProgress(): Progress {
  const fresh: Progress = { unlocked: 1, current: 1, best: {}, done: [], stars: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null');
    if (raw && typeof raw.unlocked === 'number') {
      return {
        unlocked: Math.min(LEVELS.length, Math.max(1, raw.unlocked)),
        current: Math.min(LEVELS.length, Math.max(1, raw.current ?? 1)),
        best: raw.best ?? {},
        done: Array.isArray(raw.done) ? raw.done : [],
        stars: raw.stars ?? {},
      };
    }
    // Carry over the best score from before there were levels
    const old = Number(localStorage.getItem(OLD_BEST_KEY)) || 0;
    if (old) fresh.best[1] = old;
  } catch {
    // Storage blocked: start fresh, nothing remembered
  }
  return fresh;
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // Not remembered; fine
  }
}

/** Share of a level's treats needed for the treat star. */
export const TREAT_STAR_SHARE = 0.7;
