/**
 * Fetch Dash free hero portraits: 3 per pet, for up to 3 pets, 9 per player.
 *
 * Paste into the Wix site as backend/fetchDashPets.js. Plain functions with no
 * Wix imports, so they can be tested anywhere. appBackend.js keeps the
 * FetchDashPlayers record and calls these.
 *
 * A pet is told apart by its name (the one lettered on the portrait), the way
 * the game does it: "Chewy", "chewy " and "CHEWY!" are one pet. Only portraits
 * that came out are counted.
 *
 * The player's record keeps its pets in a `pets` field (Object type in the
 * collection), like:
 *   { "chewy": { "name": "Chewy", "used": 2 }, "luna": { "name": "Luna", "used": 3 } }
 */

export const PORTRAITS_PER_PET = 3;
export const MAX_PETS = 3;
export const TOTAL_PORTRAITS = PORTRAITS_PER_PET * MAX_PETS;

/** Lower case, letters and digits only. Must match petKey in the game (src/hero/store.ts). */
export function petKey(name) {
  return String(name ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** The pet name for a design request: `pet`, or the lettered text from older game builds. */
export function petNameFrom(body) {
  const raw = typeof body?.pet === 'string' && body.pet.trim() ? body.pet : body?.text;
  return String(raw ?? '').trim().slice(0, 40);
}

/** The record's pets, cleaned up. (A record from before the per-pet rule has
 * only a total and no pets; it starts again under the new rule. Only test
 * phones made portraits then.) */
export function petsOf(record) {
  const out = {};
  const raw = record && typeof record.pets === 'object' && record.pets ? record.pets : {};
  for (const [k, v] of Object.entries(raw)) {
    const used = Math.max(0, Math.min(PORTRAITS_PER_PET, Math.floor(Number(v?.used) || 0)));
    if (k && used > 0) out[k] = { name: String(v?.name || k), used };
  }
  return out;
}

function totals(pets) {
  const list = Object.values(pets);
  const used = list.reduce((n, p) => n + p.used, 0);
  return { used, left: Math.max(0, TOTAL_PORTRAITS - used), petsUsed: list.length };
}

/**
 * Can this player make a portrait of this pet? Returns null if yes, or the
 * error code the game shows a pop-up for:
 *   limit_game - all 9 used
 *   limit_pets - a new name, but 3 pets already have portraits
 *   limit_pet  - this pet has had its 3
 */
export function portraitRefusal(record, petName) {
  const pets = petsOf(record);
  const t = totals(pets);
  if (t.left <= 0) return 'limit_game';
  const k = petKey(petName);
  const mine = pets[k];
  if (!mine) return t.petsUsed >= MAX_PETS ? 'limit_pets' : null;
  return mine.used >= PORTRAITS_PER_PET ? 'limit_pet' : null;
}

/** Counts one portrait that came out. Returns the fields to save on the record. */
export function withPortrait(record, petName) {
  const pets = petsOf(record);
  const k = petKey(petName) || '(no name)';
  // Keeps the name as it was first typed ("Chewy", not a later "CHEWY")
  pets[k] = { name: pets[k]?.name || String(petName || '').trim() || k, used: Math.min(PORTRAITS_PER_PET, (pets[k]?.used ?? 0) + 1) };
  return { pets, portraitsUsed: totals(pets).used };
}

/** Joins an older record's count into this one (a phone that made portraits
 * under the game's old ID before the app had a reinstall-proof one). Keeps the
 * higher count for each pet, so nothing is counted twice. */
export function mergedPets(record, older) {
  const a = petsOf(record);
  const b = petsOf(older);
  for (const [k, p] of Object.entries(b)) {
    if (!a[k] || a[k].used < p.used) a[k] = p;
  }
  // Never more than 3 pets: keep the ones with the most portraits
  const keep = Object.entries(a)
    .sort((x, y) => y[1].used - x[1].used)
    .slice(0, MAX_PETS);
  const pets = Object.fromEntries(keep);
  return { pets, portraitsUsed: totals(pets).used };
}

/** The `allowance` object the game reads (GET /allowance and GET /designs/<id>). */
export function allowanceBody(record) {
  const pets = petsOf(record);
  const t = totals(pets);
  return {
    // Older game builds read this as "left in all"
    portraitsLeft: t.left,
    portraitsUsed: t.used,
    perPet: PORTRAITS_PER_PET,
    maxPets: MAX_PETS,
    total: TOTAL_PORTRAITS,
    pets: Object.values(pets).map((p) => ({ name: p.name, used: p.used, left: Math.max(0, PORTRAITS_PER_PET - p.used) })),
  };
}
