/**
 * Makes the player's hero portrait with the Design Your Pet generator on
 * goodwookie.com, using the same backend contract as the app
 * (createyourpetappo docs/backend-api.md) and its "Arcade Hero" style: the
 * pet dashing after the ball in a Player Select card, with the pet's name on
 * the plate.
 *
 * Every call says "X-Client: fetch-dash", so the backend keeps the game's
 * portraits apart from the app's designs, always makes the Arcade Hero, sends
 * a clean picture (no watermark) and counts the free portraits: 3 per pet,
 * for up to 3 pets (docs/hero-portraits.md).
 *
 * Turned on by two build settings (put them in .env.local, never in git):
 *   VITE_DYP_API_BASE = https://www.goodwookie.com
 *   VITE_DYP_APP_KEY  = the DESIGN_APP_KEY secret
 * Without them the game makes a stand-in portrait on the device instead
 * (src/hero/demo.ts), so everything can be played and tested today.
 */

import { ageLine, isAgeBand, loadAgeBand, saveAgeBand } from './age';

const BASE = (import.meta.env.VITE_DYP_API_BASE as string | undefined)?.replace(/\/$/, '');
const KEY = import.meta.env.VITE_DYP_APP_KEY as string | undefined;
// The backend makes the Arcade Hero for the game whatever is sent; this is
// only here so the request reads clearly in the logs.
const STYLE = (import.meta.env.VITE_DYP_HERO_STYLE as string | undefined) || 'arcade';
const CLIENT = 'fetch-dash';

export const LIVE = Boolean(BASE && KEY);

export class HeroError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// Plain-language messages for the backend's codes and design outcomes
const MESSAGES: Record<string, string> = {
  no_pet: "We couldn't find a pet in that photo. Try one where your pet is easy to see.",
  photo_rejected: "That photo can't be used. Try a different photo of your pet.",
  checker_down: 'The photo checker is taking a break. Try again in a minute.',
  failed: "The portrait didn't come out. Try again, or try another photo.",
  limit_game: "You've used all your free hero portraits. Make more in Design Your Pet!",
  limit_pet: "That pet has had its 3 free hero portraits. Make more in Design Your Pet!",
  limit_pets: "You've made free portraits for 3 pets. Pick one of them, or keep going in Design Your Pet!",
  limit_designs: "You've reached today's portrait limit. Try again later.",
  limit_tries: "You've reached today's limit of tries. Try again later.",
  studio_busy: 'The studio is busy right now. Try again in a minute.',
  text_rejected: "That name can't be used on a portrait. Try a different name.",
  text_checker_down: 'The name checker is taking a break. Try again in a minute.',
  bad_photo: "That photo couldn't be read. Try a JPG or PNG.",
  bad_photo_type: "That photo couldn't be read. Try a JPG or PNG.",
  upload_unavailable: "The upload didn't work. Check your connection and try again.",
  people_consent_needed: 'Please use a photo of just your pet.',
  timeout: "This one is taking a long time. Try again in a few minutes; a portrait that didn't come out isn't counted.",
  not_for_game: 'That part lives in Design Your Pet.',
  network: "Couldn't reach Design Your Pet. Check your connection and try again.",
  age_needed: 'Please tell us when you were born first.',
  age_blocked: ageLine('under13'),
  minor_portraits_paused: ageLine('13-17'),
  age_check_unavailable: 'Hero portraits are unavailable right now. Try again in a minute.',
};

/** The server's answer on age: it keeps the first band it was sent. */
function takeServerAge(body: Json): void {
  if (isAgeBand(body.ageBand)) saveAgeBand(body.ageBand, true);
}

export function messageFor(code: string): string {
  return MESSAGES[code] ?? MESSAGES.failed;
}

const DEVICE_KEY = 'fetch-dash-device';
let sessionId: string | undefined;

/** A random ID like 1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed. randomUUID only
 * exists on https pages, and the phone app loads the game from the phone, so
 * there's a fallback. */
function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** The game's own ID, kept in its storage. Gone after a reinstall, clearing
 * the app's storage, or clearing the browser. */
function storedId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked: one ID for this visit, so the calls still line up.
    sessionId ??= newId();
    return sessionId;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The phone app's player ID (mobile/playerId.ts), which survives a
 * reinstall: from the Android ID, or kept in the iPhone's Keychain. */
function appPlayer(): { id: string; kind: string } | undefined {
  const p = (window as { __FETCH_DASH_PLAYER?: { id?: unknown; kind?: unknown } | null }).__FETCH_DASH_PLAYER;
  if (p && typeof p.id === 'string' && UUID.test(p.id)) return { id: p.id, kind: String(p.kind ?? 'app') };
  return undefined;
}

/** The ID the server counts free portraits against: the app's player ID if
 * there is one, else the game's own (the web page). */
function deviceId(): string {
  return appPlayer()?.id ?? storedId();
}

/** The short code a player quotes to have their data deleted from the
 * server: the first 8 characters of the ID the server keeps them under. The
 * server's delete refuses a code that matches more than one player. */
export function gameCode(): string {
  return deviceId().replace(/[^0-9a-z]/gi, '').slice(0, 8).toUpperCase();
}

/** How long goodwookie.com keeps a portrait it painted for the game. The
 * game's own copy on the device is what the player keeps. */
export const SERVER_PORTRAIT_DAYS = 7;

/** Tells the server which kind of ID this is, and the game's older ID, so a
 * phone that made portraits before the app had a player ID keeps its count. */
function idQuery(): string {
  const app = appPlayer();
  const q = new URLSearchParams({ idKind: app?.kind ?? 'web' });
  if (app) q.set('legacyId', storedId());
  return q.toString();
}

type Json = Record<string, unknown>;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function call(path: string, init?: RequestInit): Promise<Json> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/_functions${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Id': deviceId(),
        'X-App-Key': KEY ?? '',
        'X-Client': CLIENT,
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new HeroError('network', messageFor('network'));
  }
  const body = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok && body.ok === undefined) throw new HeroError('network', messageFor('network'));
  return body;
}

/** Shrinks a big phone photo before upload; the generator doesn't need 12 MP. */
export async function preparePhoto(file: Blob, maxSide = 1600): Promise<Blob> {
  const img = await loadImage(URL.createObjectURL(file));
  const s = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * s);
  c.height = Math.round(img.height * s);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.9));
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new HeroError('bad_photo', messageFor('bad_photo')));
    img.src = src;
  });
}

export interface LiveResult {
  designId: string;
  url: string;
  /** The server's free-portrait count after this one, when it sends it. */
  allowance?: ServerAllowance;
}

export interface HeroOptions {
  /** Bring the Goodwookie sloth along, riding on the pet's head. */
  sloth?: boolean;
}

/** The server's free-portrait count for this phone. */
export interface ServerAllowance {
  /** Pets with portraits, and how many each has used. Missing from a server
   * that still counts one total per install. */
  pets?: { name: string; used: number }[];
  /** Left in all (newer server), or left on the install (older server). */
  portraitsLeft?: number;
  /** Used in all, including any without a pet name. */
  portraitsUsed?: number;
}

/** The server's count of free portraits, or undefined if it can't be reached. */
export async function fetchAllowance(): Promise<ServerAllowance | undefined> {
  if (!LIVE) return undefined;
  try {
    const a = await call(`/allowance?${idQuery()}`);
    return allowanceFrom(a);
  } catch {
    return undefined;
  }
}

function allowanceFrom(body: Json): ServerAllowance | undefined {
  const a = body.allowance as Json | undefined;
  if (!a) return undefined;
  const out: ServerAllowance = {};
  if (typeof a.portraitsLeft === 'number') out.portraitsLeft = a.portraitsLeft;
  if (typeof a.portraitsUsed === 'number') out.portraitsUsed = a.portraitsUsed;
  if (Array.isArray(a.pets)) {
    out.pets = (a.pets as Json[])
      .filter((p) => p && typeof p.name === 'string' && typeof p.used === 'number')
      .map((p) => ({ name: String(p.name), used: Number(p.used) }));
  }
  return out;
}

/**
 * Keeps the portrait on the device. The server deletes its copy after
 * SERVER_PORTRAIT_DAYS, so a saved web address would stop working. Turned
 * into a JPEG data URL (about 200 KB), trying three times; if the picture
 * still can't be read, the address is kept instead and isOnDevice() is false,
 * so the game can warn the player.
 */
export async function keepOnDevice(url: string, maxSide = 1024, tries = 3): Promise<string> {
  for (let i = 0; i < tries; i++) {
    try {
      const img = await loadImage(i ? `${url}${url.includes('?') ? '&' : '?'}try=${i}` : url);
      const s = Math.min(1, maxSide / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.88);
    } catch {
      if (i < tries - 1) await wait(1500);
    }
  }
  return url;
}

/** True when a portrait is held on the device itself, not as a server address. */
export function isOnDevice(portrait: string | undefined): boolean {
  return !!portrait && portrait.startsWith('data:');
}

/** Upload → start the design → wait for it. Calls onStep with a short status line. */
export async function generateLive(photo: Blob, name: string, onStep: (s: string) => void, opts: HeroOptions = {}): Promise<LiveResult> {
  onStep('Uploading your photo…');
  // Only the age band is sent (hero/age.ts); the server checks it too.
  const ageBand = loadAgeBand() ?? '';
  const u = await call('/uploadUrl', { method: 'POST', body: JSON.stringify({ mimeType: 'image/jpeg', ageBand }) });
  takeServerAge(u);
  if (!u.ok) throw new HeroError(String(u.code), messageFor(String(u.code)));

  let put: Response;
  try {
    put = await fetch(`${u.uploadUrl}?filename=pet.jpg`, { method: 'PUT', body: photo, headers: { 'Content-Type': 'image/jpeg' } });
  } catch {
    throw new HeroError('upload_unavailable', messageFor('upload_unavailable'));
  }
  const file = ((await put.json().catch(() => ({}))) as { file?: { id?: string } }).file;
  if (!file?.id) throw new HeroError('upload_unavailable', messageFor('upload_unavailable'));

  onStep('Suiting up…');
  let designId = '';
  for (let i = 0; i < 15 && !designId; i++) {
    const d = await call(`/designs?${idQuery()}`, {
      method: 'POST',
      // `pet` is the name the free portraits are counted under (3 per pet).
      body: JSON.stringify({ fileId: file.id, style: STYLE, text: name.toUpperCase(), pet: name.trim(), sloth: opts.sloth === true, ageBand }),
    });
    takeServerAge(d);
    if (d.ok) designId = String(d.designId);
    else if (d.code === 'one_at_a_time' && d.designId) designId = String(d.designId);
    else if (d.code === 'upload_not_ready') await wait(Number(d.retryAfterMs) || 1000);
    else throw new HeroError(String(d.code), messageFor(String(d.code)));
  }
  if (!designId) throw new HeroError('upload_unavailable', messageFor('upload_unavailable'));

  // A portrait usually takes 1 to 3 minutes; a slow one up to about 7. The
  // server gives up on a lost one after 12, so the game waits up to 10.
  const steps = [...HERO_STEPS, 'Almost there…'];
  const started = Date.now();
  for (let n = 0; Date.now() - started < 600_000; n++) {
    const slow = Date.now() - started > 240_000;
    onStep(slow ? 'Still painting. A slow one can take a few minutes…' : steps[Math.min(steps.length - 1, Math.floor(n / 8))]);
    await wait(2000);
    let d: Json;
    try {
      d = await call(`/designs/${encodeURIComponent(designId)}`);
    } catch (err) {
      // A dropped connection mid-wait isn't the end: the design keeps going.
      if (err instanceof HeroError && err.code === 'network') continue;
      throw err;
    }
    if (!d.ok) throw new HeroError(String(d.code), messageFor(String(d.code)));
    const status = String(d.status);
    if (status === 'ready' && d.previewUrl) return { designId, url: String(d.previewUrl), allowance: allowanceFrom(d) };
    if (status !== 'working') throw new HeroError(status, messageFor(status));
  }
  throw new HeroError('timeout', messageFor('timeout'));
}

/** The status lines shown while the portrait is made (also used by the stand-in). */
export const HERO_STEPS = ['Finding the hero in your photo…', 'Rolling out the meadow…', 'Throwing the ball…', 'Painting the dash…', 'Lettering the name…'];

/** Flags a portrait for Don to review (Google Play's AI-content rule). */
export async function reportDesign(designId: string, reason: 'offensive' | 'person' | 'other'): Promise<void> {
  if (!LIVE) return;
  await call('/report', { method: 'POST', body: JSON.stringify({ designId, reason }) });
}
