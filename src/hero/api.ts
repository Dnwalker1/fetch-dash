/**
 * Makes the player's hero portrait with the Design Your Pet generator on
 * goodwookie.com, using the same backend contract as the app
 * (createyourpetappo docs/backend-api.md) and its "Anime Hero" style with
 * the pet's name as the lettering.
 *
 * Turned on by two build settings (put them in .env.local, never in git):
 *   VITE_DYP_API_BASE = https://www.goodwookie.com
 *   VITE_DYP_APP_KEY  = the DESIGN_APP_KEY secret
 * Without them the game makes a stand-in portrait on the device instead
 * (src/hero/demo.ts), so everything can be played and tested today.
 */

const BASE = (import.meta.env.VITE_DYP_API_BASE as string | undefined)?.replace(/\/$/, '');
const KEY = import.meta.env.VITE_DYP_APP_KEY as string | undefined;
const STYLE = (import.meta.env.VITE_DYP_HERO_STYLE as string | undefined) || 'hero';

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
  limit_designs: "You've reached today's portrait limit. Try again later.",
  limit_tries: "You've reached today's limit of tries. Try again later.",
  studio_busy: 'The studio is busy right now. Try again in a minute.',
  text_rejected: "That name can't be used on a portrait. Try a different name.",
  bad_photo: "That photo couldn't be read. Try a JPG or PNG.",
  bad_photo_type: "That photo couldn't be read. Try a JPG or PNG.",
  upload_unavailable: "The upload didn't work. Check your connection and try again.",
  people_consent_needed: 'Please use a photo of just your pet.',
  timeout: 'This is taking longer than usual. Try again in a minute.',
  network: "Couldn't reach Design Your Pet. Check your connection and try again.",
};

export function messageFor(code: string): string {
  return MESSAGES[code] ?? MESSAGES.failed;
}

const DEVICE_KEY = 'fetch-dash-device';
function deviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'no-storage';
  }
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
}

/** Upload → start the design → wait for it. Calls onStep with a short status line. */
export async function generateLive(photo: Blob, name: string, onStep: (s: string) => void): Promise<LiveResult> {
  onStep('Uploading your photo…');
  const u = await call('/uploadUrl', { method: 'POST', body: JSON.stringify({ mimeType: 'image/jpeg' }) });
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
    const d = await call('/designs', { method: 'POST', body: JSON.stringify({ fileId: file.id, style: STYLE, text: name.toUpperCase() }) });
    if (d.ok) designId = String(d.designId);
    else if (d.code === 'one_at_a_time' && d.designId) designId = String(d.designId);
    else if (d.code === 'upload_not_ready') await wait(Number(d.retryAfterMs) || 1000);
    else throw new HeroError(String(d.code), messageFor(String(d.code)));
  }
  if (!designId) throw new HeroError('upload_unavailable', messageFor('upload_unavailable'));

  const steps = ['Finding the hero in your photo…', 'Adding the cape…', 'Painting the city lights…', 'Lettering the name…', 'Almost there…'];
  const started = Date.now();
  for (let n = 0; Date.now() - started < 180_000; n++) {
    onStep(steps[Math.min(steps.length - 1, Math.floor(n / 5))]);
    await wait(2000);
    const d = await call(`/designs/${encodeURIComponent(designId)}`);
    if (!d.ok) throw new HeroError(String(d.code), messageFor(String(d.code)));
    const status = String(d.status);
    if (status === 'ready' && d.previewUrl) return { designId, url: String(d.previewUrl) };
    if (status !== 'working') throw new HeroError(status, messageFor(status));
  }
  throw new HeroError('timeout', messageFor('timeout'));
}

/** Flags a portrait for Don to review (Google Play's AI-content rule). */
export async function reportDesign(designId: string, reason: 'offensive' | 'person' | 'other'): Promise<void> {
  if (!LIVE) return;
  await call('/report', { method: 'POST', body: JSON.stringify({ designId, reason }) });
}
