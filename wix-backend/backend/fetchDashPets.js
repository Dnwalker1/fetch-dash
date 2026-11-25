// backend/fetchDashPets.js
// FETCH DASH: FREE HERO PORTRAITS PER PET (25 Nov 2026).
//
// Don's rule: 3 free portraits per pet, for up to 3 pets, so 9 per player.
// A pet is told apart by its name, the one lettered on the portrait: "Chewy",
// "chewy " and "CHEWY!" are one pet. Only portraits that came out count.
// Renaming one pet can reach 9 for it; the 9 cap is what holds the cost.
//
// Plain functions with no Wix imports, used by appBackend.js. The game has the
// same rule and the same petKey in src/hero/store.ts, so change both together.

export const PORTRAITS_PER_PET = 3;
export const MAX_PETS = 3;
export const TOTAL_PORTRAITS = PORTRAITS_PER_PET * MAX_PETS;

/** One pet, one key: lower case, letters and digits only. "" for no name. */
export function petKey(name) {
  return String(name ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** The pet a design request is for: `pet` from the game, or the lettered
 * name (`text`) from a game build older than this rule. */
export function petNameFrom(body) {
  const raw = typeof body?.pet === 'string' && body.pet.trim() ? body.pet : body?.text;
  return String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
}

/**
 * Counts the player's portraits per pet.
 *   designIds  - every portrait that came out (FetchDashPlayers.countedDesigns)
 *   namesById  - { designId: pet name } (FetchDashPlayers.designPets)
 * Returns { "chewy": { name: "Chewy", used: 2 }, ... }. A portrait with no
 * name on record is counted under "" so it still uses up the 9.
 */
export function tallyPets(designIds, namesById) {
  const pets = {};
  for (const id of designIds) {
    const name = String(namesById?.[id] ?? '').trim();
    const k = petKey(name);
    const p = pets[k] || (pets[k] = { name: '', used: 0 });
    // Keep the name as typed in the game ("Chewy") over the lettered one ("CHEWY")
    if (name && (!p.name || (p.name === p.name.toUpperCase() && name !== name.toUpperCase()))) p.name = name;
    p.used += 1;
  }
  return pets;
}

function used(pets) {
  return Object.values(pets).reduce((n, p) => n + p.used, 0);
}

/** Pets that take one of the 3 places. Unnamed earlier portraits don't. */
function named(pets) {
  return Object.entries(pets).filter(([k]) => k);
}

/**
 * Can this player make a portrait of this pet? null if yes, otherwise the
 * code the game shows its pop-up for:
 *   limit_game - all 9 used
 *   limit_pets - a new name, and 3 pets have portraits already
 *   limit_pet  - this pet has had its 3
 * With no pet name (an upload, before the name is known) only the 9 counts.
 */
export function portraitRefusal(pets, petName) {
  if (used(pets) >= TOTAL_PORTRAITS) return 'limit_game';
  const k = petKey(petName);
  if (!k) return null;
  const mine = pets[k];
  if (!mine) return named(pets).length >= MAX_PETS ? 'limit_pets' : null;
  return mine.used >= PORTRAITS_PER_PET ? 'limit_pet' : null;
}

export function refusalMessage(code, petName) {
  const name = String(petName || '').trim() || 'This pet';
  if (code === 'limit_pet') return `${name} has had all ${PORTRAITS_PER_PET} free hero portraits.`;
  if (code === 'limit_pets') return `That's free hero portraits for ${MAX_PETS} pets already.`;
  return `That's all ${TOTAL_PORTRAITS} free hero portraits for this game.`;
}

/** The game's part of the allowance (GET /allowance, GET /designs/<id>). */
export function allowanceFields(pets) {
  const n = used(pets);
  return {
    portraitsUsed: n,
    portraitsLeft: Math.max(0, TOTAL_PORTRAITS - n),
    portraitsLimit: TOTAL_PORTRAITS,
    portraitsPerPet: PORTRAITS_PER_PET,
    maxPets: MAX_PETS,
    pets: named(pets).map(([, p]) => ({
      name: p.name,
      used: Math.min(p.used, PORTRAITS_PER_PET),
      left: Math.max(0, PORTRAITS_PER_PET - p.used)
    }))
  };
}
