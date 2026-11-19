import { GROUND_Y } from './config';

/**
 * The levels. Each one is a trail with its own look, length, speed,
 * obstacles and critters. To add a level, add an entry here (and any new
 * art in src/art/levelArt.ts).
 */

export type ObstacleKind = 'fence' | 'puddle' | 'branch' | 'log' | 'rock' | 'sandcastle' | 'driftwood' | 'umbrella';

export interface Theme {
  skyTop: number;
  skyBottom: number;
  sun: { x: number; y: number; r: number; color: number; glow: number };
  /** Background layer texture keys, far to near. */
  far: string;
  mid: string;
  near?: string;
  grass: number;
  grassDark: number;
  dirt: number;
  dirtDark: number;
  /** Tint used for the pale "sky haze" over the farthest layer. */
  haze: number;
  /** Little marks drawn along the ground: grass tufts or sand ripples. */
  tufts: 'grass' | 'sand';
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
  dogChaser: 'squirrel' | 'rabbit' | 'crab';
  /** ...and cats chase this. */
  catChaser: 'bird' | 'crab';
  /** Out-of-reach distractions. */
  gawk: ('bird' | 'den' | 'butterfly' | 'gull')[];
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
      far: 'hills',
      mid: 'bushes',
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
      far: 'mountains',
      mid: 'pines',
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
      far: 'sea',
      mid: 'palms',
      grass: 0xf1d79a,
      grassDark: 0xe0bf78,
      dirt: 0xdcb46e,
      dirtDark: 0xc79c55,
      haze: 0xffc89a,
      tufts: 'sand',
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
}

export function loadProgress(): Progress {
  const fresh: Progress = { unlocked: 1, current: 1, best: {}, done: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null');
    if (raw && typeof raw.unlocked === 'number') {
      return {
        unlocked: Math.min(LEVELS.length, Math.max(1, raw.unlocked)),
        current: Math.min(LEVELS.length, Math.max(1, raw.current ?? 1)),
        best: raw.best ?? {},
        done: Array.isArray(raw.done) ? raw.done : [],
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
