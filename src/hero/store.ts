/**
 * The player's hero: the pet's name and its portrait. (Species, size and
 * color are kept with the pet choice in src/art/pets.ts.)
 *
 * The game gives 3 free portraits, separate from Design Your Pet's own
 * limits. This count lives on the device for now; once the live generator
 * is on, the server should count them too (see docs/hero-portraits.md).
 */

export const FREE_PORTRAITS = 3;

export interface Hero {
  name: string;
  /** Image URL or data URL of the full portrait. */
  portrait?: string;
  /** 'live' = Design Your Pet made it; 'demo' = the stand-in made on the device. */
  source?: 'live' | 'demo';
  designId?: string;
}

const HERO_KEY = 'fetch-dash-hero';
const USED_KEY = 'fetch-dash-portraits-used';

export function loadHero(): Hero | null {
  try {
    const raw = JSON.parse(localStorage.getItem(HERO_KEY) ?? 'null');
    if (raw && typeof raw.name === 'string') return raw as Hero;
  } catch {
    // fall through
  }
  return null;
}

export function saveHero(h: Hero): boolean {
  try {
    localStorage.setItem(HERO_KEY, JSON.stringify(h));
    return true;
  } catch {
    // Too big or storage blocked. Keep the name at least.
    try {
      localStorage.setItem(HERO_KEY, JSON.stringify({ ...h, portrait: undefined }));
    } catch {
      // nothing remembered
    }
    return false;
  }
}

export function portraitsUsed(): number {
  try {
    return Number(localStorage.getItem(USED_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function portraitsLeft(): number {
  return Math.max(0, FREE_PORTRAITS - portraitsUsed());
}

export function countPortrait(): void {
  try {
    localStorage.setItem(USED_KEY, String(portraitsUsed() + 1));
  } catch {
    // not counted; fine
  }
}

export function displayName(h: Hero | null, species: 'dog' | 'cat'): string {
  const n = h?.name.trim();
  return n || (species === 'cat' ? 'your cat' : 'your pup');
}

/** Capitalizes the first letter, for a name at the start of a sentence. */
export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
