import { GROUND_Y } from './config';
import type { LedgeStyle } from './art/ledges';

/**
 * The levels. Each one is a trail with its own look, obstacles and critters,
 * and some have their own way to play (climbing, tunnels, swimming, a run
 * into the screen, a dark wood, low gravity).
 *
 * A level has two numbers: `art`, which never changes and names its pictures
 * (public/art/l<art>) and anything painted for it, and `id`, its place on the
 * trail map (Level 1, Level 2...). The play order is ORDER below, picked so
 * the same way of playing never comes twice in a row; a level's length and
 * speed come from its place in that order, so the game still gets steadily
 * harder. To add a level, add a spec to SPECS and put its art number in ORDER.
 */

export type ObstacleKind =
  | 'fence' | 'fence-rail' | 'puddle' | 'branch' | 'log' | 'rock' | 'sandcastle' | 'driftwood' | 'umbrella'
  | 'trashcan' | 'hydrant' | 'sign' | 'awning' | 'stump' | 'creek' | 'snowman' | 'sled' | 'snowbranch'
  | 'haybale' | 'pumpkin' | 'autumnbranch' | 'cactus' | 'tumbleweed' | 'arch' | 'trough' | 'clothesline'
  | 'lantern' | 'pond' | 'blossombranch' | 'vines' | 'crate' | 'barrel' | 'banner'
  | 'moon-rock' | 'crater' | 'moon-flag' | 'space-arch';

export type ChaserKind =
  | 'squirrel' | 'rabbit' | 'crab' | 'bird' | 'cat' | 'dog' | 'frog' | 'fox' | 'cardinal'
  | 'chipmunk' | 'mouse' | 'lizard' | 'chicken' | 'monkey' | 'parrot' | 'seagull' | 'moonbug';
export type GawkKind =
  | 'bird' | 'den' | 'butterfly' | 'gull' | 'pigeon' | 'person' | 'duck' | 'owl'
  | 'crow' | 'hawk' | 'parrot' | 'balloon' | 'ufo';

/** One scrolling background layer: texture, height in px, scroll speed vs. the trail. */
export interface Layer {
  key: string;
  /** Height in px. Painted layers (with `src`) work it out from the picture. */
  h?: number;
  /** A painted picture for this layer (in public/), instead of drawn-in-code art. */
  src?: string;
  /** How much to shrink or grow the painted picture. */
  scale?: number;
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
  /** A painted sky picture (in public/) that fills the screen, sun and clouds included. */
  skyImage?: string;
  /**
   * Where the painted sky sits, when it shouldn't just fill the screen: its scale
   * (from the 1280 px wide picture) and top-left corner. Used to set a low sun
   * right on the horizon. It only has to reach down to the ground line.
   */
  skyFit?: { scale: number; x: number; y: number };
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
  weather?: 'rain' | 'snow' | 'leaves' | 'petals' | 'fireworks' | 'fireflies';
  /** Lightning now and then (with rain). */
  storm?: boolean;
  /** Little colored bits scattered on the grass (fallen leaves, petals). */
  speckle?: number;
  grass: number;
  grassDark: number;
  dirt: number;
  dirtDark: number;
  /** Tint used for the pale "sky haze" over the farthest layer. */
  haze: number;
  /** Little marks drawn along the ground. 'street' draws a sidewalk and road instead of a dirt path. */
  tufts: 'grass' | 'sand' | 'street' | 'snow' | 'boards' | 'moon';
}

/** The ways a level can play, shown on the trail map. */
export type PlayStyle = 'run' | 'climb' | 'dig' | 'swim' | 'horizon' | 'dark' | 'space';

export interface LevelDef {
  /** Its place on the trail map (1 = first). Worked out from ORDER. */
  id: number;
  /** Names its pictures and painted bits; never changes when levels are reordered. */
  art: number;
  name: string;
  tagline: string;
  /** Little landmark shown next to the level's stop on the trail map. */
  icon: string;
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
  /**
   * Climbing sections: stone ledges in steps up to a high ridge with treats on
   * top, while the trail below keeps its obstacles. The first comes after
   * `firstM` meters, then one every `everyM` meters.
   */
  climb?: { style: LedgeStyle; firstM: number; everyM: [number, number]; tall?: boolean };
  /** Dig spots that lead into a tunnel: the first after `firstM` meters, then one every `everyM`. */
  dig?: { firstM: number; everyM: [number, number] };
  /**
   * Swimming: stretches where the trail turns into water. The first starts
   * after `firstM` meters; each is `lengthM` long, with `gapM` of dry trail
   * before the next.
   */
  swim?: { firstM: number; lengthM: [number, number]; gapM: [number, number]; obstacles: SwimObstacle[] };
  /**
   * Runs into the screen: the trail turns toward the horizon for `lengthM`
   * meters, with `gapM` of side-on trail between. Obstacles come in three
   * lanes; `scenery` is what grows along the sides.
   */
  horizon?: { firstM: number; lengthM: number; gapM: [number, number]; obstacles: ObstacleKind[]; scenery: 'meadow' | 'sunflowers' };
  /** A dark level: the pet carries a little light, and the trail ahead is lit by it. */
  dark?: boolean;
  /** Low gravity (the Moon): this share of the usual pull, so jumps float. */
  gravity?: number;
  /** What the thrown ball is here (a moon-cheese ball on the Moon). */
  ball?: string;
  theme: Theme;
}

/** What floats in the water or hangs over it: hop over logs, crates and lily pads, dive under the footbridge. */
export type SwimObstacle = 'float-log' | 'float-crate' | 'lily' | 'footbridge';

/** A level as written in SPECS: its place, length and speed are filled in from ORDER. */
type LevelSpec = Omit<LevelDef, 'id' | 'goalMeters' | 'speed'>;

const SPECS: LevelSpec[] = [
  {
    art: 1,
    name: 'Park Trail',
    tagline: 'A sunny run through the park',
    icon: '🌳',
    obstacles: { fence: 4, puddle: 3, branch: 3 },
    hills: { height: 0, length: 1 },
    dogChaser: 'squirrel',
    catChaser: 'bird',
    gawk: ['bird', 'den', 'butterfly'],
    theme: {
      skyTop: 0x8fd3ff,
      skyBottom: 0xdff3ff,
      sun: { x: 820, y: 90, r: 44, color: 0xffe08a, glow: 0xffe08a },
      // Painted art, made in Grok from the art prompt sheet
      skyImage: 'art/l1/sky.webp',
      layers: [
        { key: 'l1-far', src: 'art/l1/far.webp', scale: 1.5, factor: 0.2 },
        { key: 'l1-mid', src: 'art/l1/mid.webp', scale: 0.8, factor: 0.45 },
      ],
      raysAlpha: 0.4,
      cloudsAlpha: 1,
      // matched to the painted grass
      grass: 0x8fb04a,
      grassDark: 0x6f8f36,
      dirt: 0xbf9f6e,
      dirtDark: 0xa3855a,
      haze: 0xdff3ff,
      tufts: 'grass',
    },
  },
  {
    art: 2,
    name: 'Hilltop Trail',
    tagline: 'Up and down the rolling hills',
    icon: '⛰️',
    obstacles: { log: 3, rock: 3, branch: 3, fence: 1 },
    hills: { height: 70, length: 1500 },
    dogChaser: 'rabbit',
    catChaser: 'bird',
    gawk: ['bird', 'den', 'butterfly'],
    climb: { style: 'rock', firstM: 140, everyM: [230, 300] },
    theme: {
      skyTop: 0x6fb8f0,
      skyBottom: 0xfbe9c8,
      sun: { x: 760, y: 120, r: 46, color: 0xffd36b, glow: 0xffc14d },
      // Painted art, made in Grok from the art prompt sheet
      skyImage: 'art/l2/sky.webp',
      layers: [
        { key: 'l2-far', src: 'art/l2/far.webp', scale: 1, factor: 0.2 },
        { key: 'l2-mid', src: 'art/l2/mid.webp', scale: 0.7, factor: 0.45 },
      ],
      raysAlpha: 0.4,
      cloudsAlpha: 1,
      // matched to the painted grass
      grass: 0x8cb83f,
      grassDark: 0x6a9230,
      dirt: 0xb08a5c,
      dirtDark: 0x92704a,
      haze: 0xf5e2c0,
      tufts: 'grass',
    },
  },
  {
    art: 3,
    name: 'Sunset Beach',
    tagline: 'Race the sunset along the sand',
    icon: '🌴',
    obstacles: { sandcastle: 3, driftwood: 3, umbrella: 3, puddle: 1 },
    hills: { height: 34, length: 1100 },
    dogChaser: 'crab',
    catChaser: 'crab',
    gawk: ['gull', 'butterfly'],
    theme: {
      skyTop: 0x5a4a9c,
      skyBottom: 0xffb36b,
      sun: { x: 700, y: 230, r: 62, color: 0xffd27a, glow: 0xff8a5c },
      // Painted art, made in Grok from the art prompt sheet. The sky is moved up
      // so the sun sits half set on the sea.
      skyImage: 'art/l3/sky.webp',
      skyFit: { scale: 0.8, x: -32, y: -120 },
      layers: [
        { key: 'l3-far', src: 'art/l3/far.webp', scale: 0.75, factor: 0.05 },
        { key: 'l3-mid', src: 'art/l3/mid.webp', scale: 0.55, factor: 0.45 },
      ],
      raysAlpha: 0.7,
      cloudsAlpha: 0.55,
      // matched to the painted sand
      grass: 0xe2a65a,
      grassDark: 0xc98c47,
      dirt: 0xcf9550,
      dirtDark: 0xb07a3e,
      haze: 0xffc89a,
      tufts: 'sand',
    },
  },
  {
    art: 4,
    name: 'Main Street',
    tagline: 'Downtown at dusk, lights coming on',
    icon: '🏙️',
    obstacles: { trashcan: 3, hydrant: 3, sign: 2, awning: 3 },
    hills: { height: 0, length: 1 },
    dogChaser: 'cat',
    catChaser: 'dog',
    gawk: ['pigeon', 'person'],
    theme: {
      skyTop: 0x3d3f7a,
      skyBottom: 0xf2a07a,
      sun: { x: 300, y: 300, r: 50, color: 0xffc27a, glow: 0xff8a5c },
      // Painted art, made in Grok from the art prompt sheet
      skyImage: 'art/l4/sky.webp',
      skyFit: { scale: 0.85, x: -64, y: -172 },
      layers: [
        { key: 'l4-far', src: 'art/l4/far.webp', scale: 0.75, factor: 0.15 },
        { key: 'l4-mid', src: 'art/l4/mid.webp', scale: 0.55, factor: 0.45 },
      ],
      raysAlpha: 0.25,
      cloudsAlpha: 0.45,
      cloudTint: 0xf3c6c0,
      grass: 0xd8b98a, // sidewalk, matched to the painted one
      grassDark: 0x8f8170, // curb
      dirt: 0x55575d, // road
      dirtDark: 0xe8c547, // lane paint
      haze: 0xf2a07a,
      tufts: 'street',
    },
  },
  {
    art: 5,
    name: 'Rainy Riverside',
    tagline: 'Splash along the river in the rain',
    icon: '🌧️',
    obstacles: { stump: 3, creek: 3, log: 2, rock: 2, branch: 3 },
    hills: { height: 40, length: 1300 },
    dogChaser: 'frog',
    catChaser: 'frog',
    gawk: ['duck', 'den'],
    dig: { firstM: 150, everyM: [380, 460] },
    theme: {
      skyTop: 0x7d8a99,
      skyBottom: 0xc9d3d9,
      // Painted art, made in Grok from the art prompt sheet
      skyImage: 'art/l5/sky.webp',
      layers: [
        { key: 'l5-far', src: 'art/l5/far.webp', scale: 0.75, factor: 0.12, lift: 60 },
        { key: 'l5-mid', src: 'art/l5/mid.webp', scale: 0.65, factor: 0.3, lift: 90 },
        { key: 'l5-river', src: 'art/l5/river.webp', scale: 0.3, factor: 0.45 },
      ],
      raysAlpha: 0,
      cloudsAlpha: 0.9,
      cloudTint: 0xaab4bd,
      weather: 'rain',
      // matched to the painted reeds
      grass: 0x6b8a4c,
      grassDark: 0x56733c,
      dirt: 0x6e5a40,
      dirtDark: 0x58472f,
      haze: 0xc9d3d9,
      tufts: 'grass',
    },
  },
  {
    art: 6,
    name: 'Snowy Night',
    tagline: 'A moonlit dash through the snow',
    icon: '❄️',
    obstacles: { snowman: 3, sled: 3, snowbranch: 3, rock: 1 },
    hills: { height: 60, length: 1600 },
    dogChaser: 'fox',
    catChaser: 'cardinal',
    gawk: ['owl', 'den'],
    theme: {
      skyTop: 0x0f1a3a,
      skyBottom: 0x34477a,
      sun: { x: 760, y: 100, r: 38, color: 0xf4f1dc, glow: 0xc9d6ff },
      // Painted art, made in Grok from the art prompt sheet
      skyImage: 'art/l6/sky.webp',
      layers: [
        { key: 'l6-far', src: 'art/l6/far.webp', scale: 0.85, factor: 0.2, lift: 50 },
        // the painting is lit like daytime: a cool tint makes it moonlit
        { key: 'l6-mid', src: 'art/l6/mid.webp', scale: 0.7, factor: 0.45, tint: 0xb4c0e8 },
      ],
      raysAlpha: 0,
      cloudsAlpha: 0.25,
      cloudTint: 0x9fb0d6,
      night: true,
      weather: 'snow',
      // matched to the painted snow
      grass: 0xdfe2f4,
      grassDark: 0xbcc2e2,
      dirt: 0xd0d5ee,
      dirtDark: 0xa9b0d6,
      haze: 0x34477a,
      tufts: 'snow',
    },
  },
  {
    art: 7,
    name: 'Autumn Orchard',
    tagline: 'Crunchy leaves and apple trees',
    icon: '🍎',
    obstacles: { haybale: 3, pumpkin: 3, autumnbranch: 3, 'fence-rail': 1 },
    hills: { height: 50, length: 1400 },
    dogChaser: 'chipmunk',
    catChaser: 'mouse',
    gawk: ['crow', 'den'],
    theme: {
      skyTop: 0x7fb6e0,
      skyBottom: 0xffe2b0,
      // Painted art, made in Grok from the art prompt sheet
      skyImage: 'art/l7/sky.webp',
      layers: [
        { key: 'l7-far', src: 'art/l7/far.webp', scale: 0.8, factor: 0.15 },
        { key: 'l7-mid', src: 'art/l7/mid.webp', scale: 0.7, factor: 0.45 },
      ],
      raysAlpha: 0.45,
      cloudsAlpha: 0.9,
      weather: 'leaves',
      speckle: 0xd9692a,
      grass: 0xa9a24a,
      grassDark: 0x8a8536,
      dirt: 0xa8774a,
      dirtDark: 0x8a5f38,
      haze: 0xffe2b0,
      tufts: 'grass',
    },
  },
  {
    art: 8,
    name: 'Desert Canyon',
    tagline: 'Red rocks and rolling tumbleweeds',
    icon: '🌵',
    obstacles: { cactus: 3, tumbleweed: 3, rock: 2, arch: 3 },
    hills: { height: 50, length: 1400 },
    dogChaser: 'lizard',
    catChaser: 'lizard',
    gawk: ['hawk', 'den'],
    climb: { style: 'sandstone', firstM: 180, everyM: [280, 360] },
    theme: {
      skyTop: 0x4f9ee8,
      skyBottom: 0xffd9a0,
      // Painted art, made in Grok from the art prompt sheet
      skyImage: 'art/l8/sky.webp',
      layers: [
        { key: 'l8-far', src: 'art/l8/far.webp', scale: 0.85, factor: 0.12, lift: 20 },
        { key: 'l8-mid', src: 'art/l8/mid.webp', scale: 0.6, factor: 0.45 },
      ],
      raysAlpha: 0.6,
      cloudsAlpha: 0.35,
      grass: 0xe2b07a,
      grassDark: 0xc98e58,
      dirt: 0xc77b4a,
      dirtDark: 0xa8613a,
      haze: 0xffd9a0,
      tufts: 'sand',
    },
  },
  {
    art: 9,
    name: 'Sunny Farm',
    tagline: 'Barns, hay and a very busy chicken',
    icon: '🐄',
    obstacles: { haybale: 3, trough: 3, 'fence-rail': 2, clothesline: 3 },
    hills: { height: 30, length: 1200 },
    dogChaser: 'chicken',
    catChaser: 'mouse',
    gawk: ['bird', 'person', 'butterfly'],
    dig: { firstM: 200, everyM: [420, 520] },
    theme: {
      skyTop: 0x6ec4ff,
      skyBottom: 0xe8f6ff,
      // Painted art, made in Grok from the art prompt sheet
      skyImage: 'art/l9/sky.webp',
      layers: [
        { key: 'l9-far', src: 'art/l9/far.webp', scale: 0.8, factor: 0.2 },
        { key: 'l9-mid', src: 'art/l9/mid.webp', scale: 0.5, factor: 0.45 },
      ],
      raysAlpha: 0.4,
      cloudsAlpha: 1,
      grass: 0x7cc055,
      grassDark: 0x5f9e3f,
      dirt: 0xb98b5a,
      dirtDark: 0xa77b4d,
      haze: 0xe8f6ff,
      tufts: 'grass',
    },
  },
  {
    art: 10,
    name: 'Blossom Garden',
    tagline: 'Pink petals and quiet ponds',
    icon: '🌸',
    obstacles: { lantern: 3, pond: 3, blossombranch: 3, rock: 1 },
    hills: { height: 30, length: 1100 },
    dogChaser: 'rabbit',
    catChaser: 'bird',
    gawk: ['butterfly', 'den', 'bird'],
    theme: {
      skyTop: 0x9fd0f5,
      skyBottom: 0xffe6ef,
      // Painted art, made in Grok from the art prompt sheet
      skyImage: 'art/l10/sky.webp',
      layers: [
        { key: 'l10-far', src: 'art/l10/far.webp', scale: 0.8, factor: 0.12 },
        { key: 'l10-mid', src: 'art/l10/mid.webp', scale: 0.6, factor: 0.45 },
      ],
      raysAlpha: 0.3,
      cloudsAlpha: 0.8,
      cloudTint: 0xffe0ea,
      weather: 'petals',
      speckle: 0xf4b6c8,
      grass: 0x86c46a,
      grassDark: 0x6aa852,
      dirt: 0xd2b48c,
      dirtDark: 0xb89870,
      haze: 0xffe6ef,
      tufts: 'grass',
    },
  },
  {
    art: 11,
    name: 'Jungle Falls',
    tagline: 'Vines, waterfalls and cheeky monkeys',
    icon: '🦜',
    obstacles: { vines: 3, log: 2, stump: 2, creek: 3 },
    hills: { height: 70, length: 1500 },
    dogChaser: 'monkey',
    catChaser: 'parrot',
    gawk: ['parrot', 'den'],
    swim: { firstM: 220, lengthM: [70, 100], gapM: [240, 320], obstacles: ['float-log', 'lily', 'footbridge'] },
    theme: {
      skyTop: 0x5fb8d8,
      skyBottom: 0xdaf2e0,
      // Painted art, made in Grok from the art prompt sheet
      skyImage: 'art/l11/sky.webp',
      layers: [
        { key: 'l11-far', src: 'art/l11/far.webp', scale: 0.55, factor: 0.15 },
        { key: 'l11-mid', src: 'art/l11/mid.webp', scale: 0.55, factor: 0.45 },
      ],
      raysAlpha: 0.35,
      cloudsAlpha: 0.7,
      grass: 0x4f9e3e,
      grassDark: 0x3f8030,
      dirt: 0x7a5232,
      dirtDark: 0x5f3e24,
      haze: 0xdaf2e0,
      tufts: 'grass',
    },
  },
  {
    art: 12,
    name: 'Fireworks Pier',
    tagline: 'The big finale on the boardwalk',
    icon: '🎆',
    obstacles: { crate: 3, barrel: 3, banner: 3, trashcan: 1 },
    hills: { height: 0, length: 1 },
    dogChaser: 'seagull',
    catChaser: 'seagull',
    gawk: ['balloon', 'person'],
    theme: {
      skyTop: 0x0d1436,
      skyBottom: 0x3a2d6b,
      // Painted art, made in Grok from the art prompt sheet. The night sea sits
      // low, so its top lines up with the horizon between the tents.
      skyImage: 'art/l12/sky.webp',
      layers: [
        { key: 'l12-far', src: 'art/l12/far.webp', scale: 0.6, factor: 0.05, lift: -46 },
        { key: 'l12-mid', src: 'art/l12/mid.webp', scale: 0.6, factor: 0.45 },
      ],
      raysAlpha: 0,
      cloudsAlpha: 0.2,
      cloudTint: 0x6a6aa0,
      night: true,
      weather: 'fireworks',
      grass: 0xb08a5e, // boardwalk planks
      grassDark: 0x7a5a3a,
      dirt: 0x1c2a4a, // the water under the pier
      dirtDark: 0x3a4a7a,
      haze: 0x3a2d6b,
      tufts: 'boards',
    },
  },
  // ---------- Round 2 (25 November): new ways to play ----------
  // Painted by Elon (26 November) from the list in docs/levels-round-2.md.
  {
    art: 13,
    name: 'Open Meadow',
    tagline: 'The trail turns toward the faraway hills',
    icon: '🌼',
    obstacles: { fence: 3, rock: 3, branch: 3, log: 2 },
    hills: { height: 30, length: 1300 },
    dogChaser: 'rabbit',
    catChaser: 'bird',
    gawk: ['butterfly', 'bird', 'den'],
    horizon: { firstM: 70, lengthM: 190, gapM: [70, 100], obstacles: ['rock', 'log', 'stump'], scenery: 'meadow' },
    theme: {
      skyTop: 0x8fd3ff,
      skyBottom: 0xe8f6ff,
      skyImage: 'art/l13/sky.webp',
      layers: [
        { key: 'l13-far', src: 'art/l13/far.webp', scale: 0.85, factor: 0.12 },
        { key: 'l13-mid', src: 'art/l13/mid.webp', scale: 0.6, factor: 0.4 },
      ],
      raysAlpha: 0.4,
      cloudsAlpha: 1,
      speckle: 0xf6e27a,
      grass: 0x93be4e,
      grassDark: 0x72a03a,
      dirt: 0xc4a473,
      dirtDark: 0xa8895e,
      haze: 0xe8f6ff,
      tufts: 'grass',
    },
  },
  {
    art: 14,
    name: 'Sunflower Road',
    tagline: 'A country road through the sunflowers',
    icon: '🌻',
    obstacles: { haybale: 3, 'fence-rail': 2, rock: 2, branch: 3 },
    hills: { height: 24, length: 1200 },
    dogChaser: 'chicken',
    catChaser: 'mouse',
    gawk: ['crow', 'bird', 'den'],
    horizon: { firstM: 60, lengthM: 220, gapM: [70, 110], obstacles: ['haybale', 'rock', 'pumpkin'], scenery: 'sunflowers' },
    theme: {
      skyTop: 0x7fb6e0,
      skyBottom: 0xffe8b8,
      skyImage: 'art/l14/sky.webp',
      layers: [
        { key: 'l14-far', src: 'art/l14/far.webp', scale: 0.75, factor: 0.15 },
        { key: 'l14-mid', src: 'art/l14/mid.webp', scale: 0.6, factor: 0.45 },
      ],
      raysAlpha: 0.5,
      cloudsAlpha: 0.9,
      speckle: 0xf2c84a,
      grass: 0xa6b24a,
      grassDark: 0x86933a,
      dirt: 0xc39a62,
      dirtDark: 0xa57f4e,
      haze: 0xffe8b8,
      tufts: 'grass',
    },
  },
  {
    art: 15,
    name: 'Lake Crossing',
    tagline: 'Paddle across the lake to the far shore',
    icon: '🦆',
    obstacles: { log: 3, rock: 2, branch: 3, stump: 2 },
    hills: { height: 0, length: 1 },
    dogChaser: 'frog',
    catChaser: 'frog',
    gawk: ['duck', 'butterfly'],
    swim: { firstM: 50, lengthM: [170, 230], gapM: [40, 70], obstacles: ['float-log', 'float-crate', 'lily', 'footbridge'] },
    theme: {
      skyTop: 0x8fc8f0,
      skyBottom: 0xfbe6d8,
      skyImage: 'art/l15/sky.webp',
      layers: [
        { key: 'l15-far', src: 'art/l15/far.webp', scale: 0.8, factor: 0.12 },
        { key: 'l15-mid', src: 'art/l15/mid.webp', scale: 0.6, factor: 0.35 },
      ],
      raysAlpha: 0.35,
      cloudsAlpha: 0.8,
      grass: 0x7fae4a,
      grassDark: 0x5f8f36,
      dirt: 0xa88a62,
      dirtDark: 0x8a6f4c,
      haze: 0xf3e6e6,
      tufts: 'grass',
    },
  },
  {
    art: 16,
    name: 'Thunderstorm Trail',
    tagline: 'The storm turns the trail into streams',
    icon: '⛈️',
    obstacles: { stump: 3, log: 2, puddle: 2, branch: 3, rock: 1 },
    hills: { height: 40, length: 1300 },
    dogChaser: 'rabbit',
    catChaser: 'mouse',
    gawk: ['duck', 'den'],
    swim: { firstM: 110, lengthM: [55, 90], gapM: [110, 170], obstacles: ['float-log', 'float-crate', 'footbridge'] },
    theme: {
      skyTop: 0x4a5462,
      skyBottom: 0x8d97a3,
      skyImage: 'art/l16/sky.webp',
      layers: [
        { key: 'l16-far', src: 'art/l16/far.webp', scale: 0.8, factor: 0.12 },
        { key: 'l16-mid', src: 'art/l16/mid.webp', scale: 0.55, factor: 0.45 },
      ],
      raysAlpha: 0,
      cloudsAlpha: 0.9,
      cloudTint: 0x7a8490,
      weather: 'rain',
      storm: true,
      grass: 0x5f7f46,
      grassDark: 0x4a6838,
      dirt: 0x64523c,
      dirtDark: 0x4f402e,
      haze: 0x8d97a3,
      tufts: 'grass',
    },
  },
  {
    art: 17,
    name: 'Mountain Switchbacks',
    tagline: 'Leap up the ledges, high above the valley',
    icon: '🏔️',
    obstacles: { rock: 3, log: 2, branch: 3, stump: 2 },
    hills: { height: 80, length: 1600 },
    dogChaser: 'chipmunk',
    catChaser: 'bird',
    gawk: ['hawk', 'den'],
    climb: { style: 'rock', firstM: 100, everyM: [170, 230], tall: true },
    theme: {
      skyTop: 0x5fa8e8,
      skyBottom: 0xeaf2ff,
      skyImage: 'art/l17/sky.webp',
      layers: [
        { key: 'l17-far', src: 'art/l17/far.webp', scale: 0.85, factor: 0.12 },
        { key: 'l17-mid', src: 'art/l17/mid.webp', scale: 0.6, factor: 0.45 },
      ],
      raysAlpha: 0.45,
      cloudsAlpha: 0.8,
      grass: 0x86b04a,
      grassDark: 0x668e38,
      dirt: 0x9c8466,
      dirtDark: 0x806a50,
      haze: 0xeaf2ff,
      tufts: 'grass',
    },
  },
  {
    art: 18,
    name: 'Night Woods',
    tagline: 'Follow your little light through the dark woods',
    icon: '🦉',
    obstacles: { log: 3, stump: 3, rock: 2, branch: 3 },
    hills: { height: 40, length: 1300 },
    dogChaser: 'fox',
    catChaser: 'mouse',
    gawk: ['owl', 'den'],
    dark: true,
    theme: {
      skyTop: 0x0c1430,
      skyBottom: 0x26335e,
      sun: { x: 760, y: 100, r: 34, color: 0xf4f1dc, glow: 0xc9d6ff },
      skyImage: 'art/l18/sky.webp',
      layers: [
        { key: 'l18-far', src: 'art/l18/far.webp', scale: 0.85, factor: 0.12 },
        { key: 'l18-mid', src: 'art/l18/mid.webp', scale: 0.55, factor: 0.45 },
      ],
      raysAlpha: 0,
      cloudsAlpha: 0.2,
      cloudTint: 0x6a78a0,
      night: true,
      weather: 'fireflies',
      grass: 0x3f5a3a,
      grassDark: 0x30482e,
      dirt: 0x4a3e32,
      dirtDark: 0x3a3028,
      haze: 0x26335e,
      tufts: 'grass',
    },
  },
  {
    art: 19,
    name: 'Moon Run',
    tagline: 'One giant leap for dog (and cat) kind',
    icon: '🚀',
    obstacles: { 'moon-rock': 3, crater: 3, 'moon-flag': 1, 'space-arch': 3 },
    hills: { height: 36, length: 1500 },
    dogChaser: 'moonbug',
    catChaser: 'moonbug',
    gawk: ['ufo'],
    gravity: 0.45,
    ball: 'moon-ball',
    theme: {
      skyTop: 0x05060f,
      skyBottom: 0x141a33,
      skyImage: 'art/l19/sky.webp',
      layers: [
        { key: 'l19-earth', src: 'art/l19/earth-rise.webp', scale: 0.5, factor: 0.02, lift: 190 },
        { key: 'l19-far', src: 'art/l19/far.webp', scale: 0.8, factor: 0.12 },
        { key: 'l19-mid', src: 'art/l19/mid.webp', scale: 0.6, factor: 0.4 },
      ],
      raysAlpha: 0,
      cloudsAlpha: 0,
      night: true,
      grass: 0xb8b8c4,
      grassDark: 0x8e8ea0,
      dirt: 0x9a9aac,
      dirtDark: 0x77778a,
      haze: 0x141a33,
      tufts: 'moon',
    },
  },
];

/**
 * The play order, by art number: the same way of playing never comes twice
 * in a row (run, climb, dig, swim, horizon, dark, space).
 */
const ORDER = [1, 2, 3, 13, 4, 15, 5, 8, 6, 11, 14, 9, 7, 17, 16, 10, 18, 12, 19];

/** How long a level is, and how fast it runs, from its place (1 = first) in the order. */
function pace(n: number): Pick<LevelDef, 'goalMeters' | 'speed'> {
  const goal = n <= 3 ? [600, 750, 900][n - 1] : Math.round((900 + (n - 3) * 42) / 25) * 25;
  return {
    goalMeters: goal,
    speed: {
      start: Math.round(300 + (n - 1) * 5),
      max: Math.round(750 + (n - 1) * 7.5),
      gainPerSecond: Math.round((6 + (n - 1) * 0.18) * 10) / 10,
    },
  };
}

export const LEVELS: LevelDef[] = ORDER.map((art, i) => {
  const spec = SPECS.find((s) => s.art === art);
  if (!spec) throw new Error(`No level with art ${art}`);
  return { ...spec, id: i + 1, ...pace(i + 1) };
});

/** How a level plays, for the map's labels. */
export function playStyle(l: LevelDef): PlayStyle {
  if (l.gravity) return 'space';
  if (l.horizon) return 'horizon';
  if (l.swim && !l.climb && !l.dig && l.art !== 11) return 'swim';
  if (l.dark) return 'dark';
  if (l.climb) return 'climb';
  if (l.dig) return 'dig';
  if (l.swim) return 'swim';
  return 'run';
}

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
/**
 * Saved progress before round 2 counted levels in the old order (1 to 12).
 * Version 2 counts them in ORDER; older saves are moved over once.
 */
const PROGRESS_V = 2;

export interface Progress {
  v?: number;
  unlocked: number; // highest level the player can pick
  current: number; // the level to start on
  best: Record<number, number>;
  done: number[]; // levels finished at least once
  stars: Record<number, number>; // most stars earned on each level (0-3)
  bonusTreats: number; // the treat jar: every treat caught, on the trail and in bonus rounds
}

/** A Backyard Toss bonus round opens after each of these levels. */
export const BONUS_AFTER = [3, 6, 9, 12, 15];

/** Where a level from the old order (its art number) sits now. */
function moved(oldId: number): number {
  return LEVELS.find((l) => l.art === oldId)?.id ?? oldId;
}

export function loadProgress(): Progress {
  const fresh: Progress = { v: PROGRESS_V, unlocked: 1, current: 1, best: {}, done: [], stars: {}, bonusTreats: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null');
    if (raw && typeof raw.unlocked === 'number') {
      const p: Progress = {
        v: PROGRESS_V,
        unlocked: Math.min(LEVELS.length, Math.max(1, raw.unlocked)),
        current: Math.min(LEVELS.length, Math.max(1, raw.current ?? 1)),
        best: raw.best ?? {},
        done: Array.isArray(raw.done) ? raw.done : [],
        stars: raw.stars ?? {},
        bonusTreats: Math.max(0, Math.floor(Number(raw.bonusTreats) || 0)),
      };
      if (raw.v !== PROGRESS_V) {
        // From the old order: move each level's results to its new place, and
        // open every level up to the farthest one finished (plus the next)
        const remap = (r: Record<number, number>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [moved(Number(k)), v]));
        p.best = remap(p.best);
        p.stars = remap(p.stars);
        p.done = p.done.map(moved);
        p.current = moved(p.current);
        p.unlocked = Math.min(LEVELS.length, Math.max(p.unlocked, ...p.done.map((d) => d + 1), p.current));
      }
      return p;
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
