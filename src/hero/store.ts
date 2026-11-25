/**
 * The player's hero: the pet's name and its portrait. (Species, size and
 * color are kept with the pet choice in src/art/pets.ts.)
 *
 * Free portraits (Don's rule, 25 Nov 2026): 3 per pet, for up to 3 pets, so
 * 9 per phone in all, separate from Design Your Pet's own limits. A pet is
 * told apart by its name, the one lettered on the portrait ("Chewy",
 * "chewy " and "CHEWY!" are the same pet). Only portraits that came out count.
 *
 * With the live generator on, goodwookie.com keeps the count against the
 * phone's player ID (src/hero/api.ts), which survives a reinstall, and the
 * game copies its count here with setServerPets. The device's own tally is
 * only the whole story for the stand-in portraits.
 */

export const PORTRAITS_PER_PET = 3;
export const MAX_PETS = 3;
export const TOTAL_PORTRAITS = PORTRAITS_PER_PET * MAX_PETS;

export interface Hero {
  name: string;
  /** Image URL or data URL of the full portrait. */
  portrait?: string;
  /** 'live' = Design Your Pet made it; 'demo' = the stand-in made on the device. */
  source?: 'live' | 'demo';
  designId?: string;
}

const HERO_KEY = 'fetch-dash-hero';
/** Before 25 Nov 2026: one count for the whole install. */
const OLD_USED_KEY = 'fetch-dash-portraits-used';
const PETS_KEY = 'fetch-dash-pets';

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

// ---------------------------------------------------------------------------
// Free portraits, per pet
// ---------------------------------------------------------------------------

/** The same key the server uses: lower case, letters and digits only. */
export function petKey(name: string): string {
  return name.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

export interface PetCount {
  /** The name as it was typed for its latest portrait. */
  name: string;
  used: number;
}

/** Pets with at least one portrait, keyed by petKey. */
type PetCounts = Record<string, PetCount>;

function readPets(): PetCounts {
  try {
    const raw = JSON.parse(localStorage.getItem(PETS_KEY) ?? 'null') as PetCounts | null;
    if (raw && typeof raw === 'object') return raw;
    // First run after the per-pet rule: give the old single count to the current hero.
    const old = Number(localStorage.getItem(OLD_USED_KEY)) || 0;
    const name = loadHero()?.name.trim() ?? '';
    if (old > 0 && petKey(name)) return { [petKey(name)]: { name, used: Math.min(old, PORTRAITS_PER_PET) } };
  } catch {
    // fall through
  }
  return {};
}

function writePets(p: PetCounts): void {
  try {
    localStorage.setItem(PETS_KEY, JSON.stringify(p));
  } catch {
    // not remembered; the server still counts
  }
}

/** The pets that have portraits, oldest first. (Key "" holds portraits the
 * server counts without a pet name, from before this rule: they use up the 9
 * but aren't a pet.) */
export function petCounts(): PetCount[] {
  return Object.entries(readPets())
    .filter(([k, p]) => k && p.used > 0)
    .map(([, p]) => p);
}

/** Takes the server's list and total (it's the one that counts). */
export function setServerPets(pets: PetCount[], totalUsed?: number): void {
  const next: PetCounts = {};
  const mine = readPets();
  const hero = loadHero()?.name.trim() ?? '';
  let sum = 0;
  for (const p of pets) {
    const k = petKey(p.name);
    if (k && p.used > 0) {
      // Older portraits only have the lettered name ("CHEWY"): show it as the player typed it
      let name = p.name;
      if (name === name.toUpperCase()) name = [mine[k]?.name, petKey(hero) === k ? hero : ''].find((n) => n && n !== n.toUpperCase()) ?? name;
      next[k] = { name, used: Math.min(PORTRAITS_PER_PET, Math.floor(p.used)) };
      sum += next[k].used;
    }
  }
  if (totalUsed !== undefined && totalUsed > sum) next[''] = { name: '', used: Math.floor(totalUsed - sum) };
  writePets(next);
}

/** Counts one portrait that came out, for this pet. */
export function countPortrait(name: string): void {
  const k = petKey(name);
  if (!k) return;
  const pets = readPets();
  pets[k] = { name: pets[k]?.name || name.trim(), used: Math.min(PORTRAITS_PER_PET, (pets[k]?.used ?? 0) + 1) };
  writePets(pets);
}

/** Marks a pet as used up, when the server says so. */
export function markPetUsedUp(name: string): void {
  const k = petKey(name);
  if (!k) return;
  const pets = readPets();
  pets[k] = { name: pets[k]?.name || name.trim(), used: PORTRAITS_PER_PET };
  writePets(pets);
}

/** Why a portrait can't be made: this pet's 3 are used, 3 pets have portraits already, or all 9 are used. */
export type LimitReason = 'pet' | 'pets' | 'total';

export interface Allowance {
  /** Portraits left for the pet with this name (3 for a new pet). */
  petLeft: number;
  /** Portraits left on this phone, all pets together. */
  totalLeft: number;
  /** How many more new pets can get portraits. */
  newPetsLeft: number;
  /** No portraits yet for this name. */
  isNew: boolean;
  /** The pet's name as first typed ("Chewy" for "CHEWY!"), or the name given for a new pet. */
  petName: string;
  /** Set when this pet can't have another free portrait. */
  blocked?: LimitReason;
}

export function allowanceFor(name: string): Allowance {
  const pets = readPets();
  const used = Object.values(pets).reduce((n, p) => n + Math.max(0, p.used), 0);
  const totalLeft = Math.max(0, TOTAL_PORTRAITS - used);
  const newPetsLeft = Math.max(0, MAX_PETS - petCounts().length);
  const mine = petKey(name) ? pets[petKey(name)] : undefined;
  const isNew = !mine || mine.used <= 0;
  const petLeft = isNew ? PORTRAITS_PER_PET : Math.max(0, PORTRAITS_PER_PET - mine.used);
  let blocked: LimitReason | undefined;
  if (totalLeft <= 0) blocked = 'total';
  else if (isNew && newPetsLeft <= 0) blocked = 'pets';
  else if (petLeft <= 0) blocked = 'pet';
  return { petLeft: Math.min(petLeft, totalLeft), totalLeft, newPetsLeft, isNew, blocked, petName: mine?.name ?? name.trim() };
}

// ---------------------------------------------------------------------------
// Each pet's hero, so the player can switch between their pets
// ---------------------------------------------------------------------------

const PET_HEROES_KEY = 'fetch-dash-pet-heroes';

export interface SavedPet<C> {
  hero: Hero;
  /** The in-game look (species, size, coat…) picked for this pet. */
  choice: C;
}

function readPetHeroes<C>(): Record<string, SavedPet<C>> {
  try {
    const raw = JSON.parse(localStorage.getItem(PET_HEROES_KEY) ?? 'null');
    if (raw && typeof raw === 'object') return raw as Record<string, SavedPet<C>>;
  } catch {
    // fall through
  }
  return {};
}

/** Remembers this pet's portrait and look, for switching back to it later. */
export function rememberPet<C>(hero: Hero, choice: C): void {
  const k = petKey(hero.name);
  if (!k) return;
  const all = readPetHeroes<C>();
  all[k] = { hero, choice };
  try {
    localStorage.setItem(PET_HEROES_KEY, JSON.stringify(all));
  } catch {
    // Too big: keep this pet without its picture
    try {
      all[k] = { hero: { ...hero, portrait: undefined }, choice };
      localStorage.setItem(PET_HEROES_KEY, JSON.stringify(all));
    } catch {
      // not remembered
    }
  }
}

export function savedPet<C>(name: string): SavedPet<C> | undefined {
  return readPetHeroes<C>()[petKey(name)];
}

/** Bring the sloth along? Remembered for the next portrait. */
const SLOTH_KEY = 'fetch-dash-sloth';
export function slothWanted(): boolean {
  try {
    return localStorage.getItem(SLOTH_KEY) === '1';
  } catch {
    return false;
  }
}
export function setSlothWanted(on: boolean): void {
  try {
    localStorage.setItem(SLOTH_KEY, on ? '1' : '0');
  } catch {
    // fine
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
