/**
 * Sound effects made on the fly with the Web Audio API, so there are no
 * audio files to license or load. Each function plays one short sound.
 * Browsers only allow sound after the player taps or presses a key, so
 * call unlock() from the first input.
 */

const MUTE_KEY = 'fetch-dash-muted';

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let muted = loadMuted();

function loadMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(m: boolean): void {
  muted = m;
  if (master) master.gain.value = m ? 0 : 0.6;
  try {
    localStorage.setItem(MUTE_KEY, m ? '1' : '0');
  } catch {
    // not remembered; fine
  }
}

export function unlock(): void {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function ready(): { ac: AudioContext; out: GainNode; t: number } | undefined {
  if (!ctx || !master || muted || ctx.state !== 'running') return undefined;
  return { ac: ctx, out: master, t: ctx.currentTime };
}

/** A gain envelope: quick attack, then decay to silence. */
function env(ac: AudioContext, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

function tone(type: OscillatorType, f0: number, f1: number, dur: number, peak = 0.3, delay = 0): void {
  const a = ready();
  if (!a) return;
  const t = a.t + delay;
  const o = a.ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = env(a.ac, t, peak, 0.01, dur);
  o.connect(g).connect(a.out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

let noiseBuf: AudioBuffer | undefined;
function noise(dur: number, filterType: BiquadFilterType, freq: number, peak: number, delay = 0, q = 1): void {
  const a = ready();
  if (!a) return;
  if (!noiseBuf) {
    noiseBuf = a.ac.createBuffer(1, a.ac.sampleRate, a.ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = a.t + delay;
  const src = a.ac.createBufferSource();
  src.buffer = noiseBuf;
  const f = a.ac.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = env(a.ac, t, peak, 0.005, dur);
  src.connect(f).connect(g).connect(a.out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.05);
}

/** "Woof": a short buzzy tone through a vocal-like filter, falling in pitch. */
export function bark(times = 1): void {
  const a = ready();
  if (!a) return;
  for (let i = 0; i < times; i++) {
    const t = a.t + i * 0.22;
    const o = a.ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(190, t + 0.14);
    const f = a.ac.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(1100, t);
    f.frequency.exponentialRampToValueAtTime(500, t + 0.14);
    f.Q.value = 2.5;
    const g = env(a.ac, t, 0.55, 0.012, 0.15);
    o.connect(f).connect(g).connect(a.out);
    o.start(t);
    o.stop(t + 0.2);
    noise(0.05, 'bandpass', 1500, 0.15, i * 0.22, 1.5);
  }
}

/** "Mee-ow": rises then falls, with a soft nasal filter. */
export function meow(): void {
  const a = ready();
  if (!a) return;
  const t = a.t;
  const o = a.ac.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(520, t);
  o.frequency.linearRampToValueAtTime(820, t + 0.15);
  o.frequency.linearRampToValueAtTime(480, t + 0.45);
  const f = a.ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.setValueAtTime(900, t);
  f.frequency.linearRampToValueAtTime(1600, t + 0.15);
  f.frequency.linearRampToValueAtTime(800, t + 0.45);
  f.Q.value = 4;
  const g = env(a.ac, t, 0.4, 0.04, 0.42);
  o.connect(f).connect(g).connect(a.out);
  o.start(t);
  o.stop(t + 0.5);
}

/** Treat crunch: a few quick crackly noise bursts. */
export function crunch(): void {
  for (let i = 0; i < 3; i++) noise(0.035, 'highpass', 1800 + Math.random() * 1500, 0.35, i * 0.03 + Math.random() * 0.01);
  tone('square', 880, 1320, 0.06, 0.06, 0.02);
}

export function jump(): void {
  tone('sine', 280, 620, 0.16, 0.25);
}

export function slide(): void {
  noise(0.25, 'bandpass', 700, 0.2, 0, 0.8);
}

export function bonk(): void {
  tone('sine', 160, 50, 0.3, 0.6);
  noise(0.12, 'lowpass', 500, 0.4);
}

/** Two-note "here, pup!" whistle. */
export function whistle(): void {
  tone('sine', 1500, 1700, 0.12, 0.18);
  tone('sine', 1300, 2100, 0.2, 0.18, 0.15);
}

/** Bright ding for the focus bonus. */
export function ding(): void {
  tone('triangle', 1320, 1320, 0.25, 0.2);
  tone('triangle', 1980, 1980, 0.3, 0.12, 0.06);
}

/** Squirrel chatter or bird chirps that warn of a distraction. */
export function chitter(): void {
  for (let i = 0; i < 4; i++) tone('square', 2400, 1800, 0.04, 0.05, i * 0.06);
}

/** Finish: a little fanfare over a crowd-like cheer swell. */
export function cheer(): void {
  const a = ready();
  if (!a) return;
  [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, i === 3 ? 0.5 : 0.14, 0.22, i * 0.12));
  // crowd: band-passed noise that swells and fades
  const t = a.t + 0.1;
  if (!noiseBuf) noise(0.01, 'lowpass', 100, 0.0001);
  if (!noiseBuf) return;
  const src = a.ac.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const f = a.ac.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = 1200;
  f.Q.value = 0.6;
  const g = a.ac.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
  src.connect(f).connect(g).connect(a.out);
  src.start(t);
  src.stop(t + 1.9);
}
