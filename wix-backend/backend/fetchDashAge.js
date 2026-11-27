// backend/fetchDashAge.js
// FETCH DASH: WHO MAY MAKE A HERO PORTRAIT, BY AGE (27 Nov 2026).
//
// Game portraits are painted by OpenAI (backend/fetchDashOpenAI.js), whose
// terms need a parent or guardian's consent for players under 18. Until that
// consent flow is built and OpenAI has switched on zero data retention,
// portraits are for players 18 and over. Everyone can still play the game.
//
// The game asks the birth month and year once and sends only a band:
// 'under13', '13-17' or '18+'. The first band a player sends is kept on their
// FetchDashPlayers row (ageBand) and a different one later is ignored, so
// answering again can't change it. The row's clean-up (fetchDashRetention.js)
// keeps ageBand with the count, and a deletion request removes it.
//
// Plain functions with no Wix imports, so they can be tested off the site.

export const AGE_BANDS = ['under13', '13-17', '18+'];

export function isAgeBand(v) {
  return AGE_BANDS.includes(v);
}

/**
 * What to do with a portrait request:
 *   { band, save, code }
 * band: the band that counts (the stored one, else the one sent), or ''.
 * save: true when the sent band should be stored (nothing stored yet).
 * code: null when the portrait may go ahead, else the refusal code.
 */
export function ageDecision(storedBand, sentBand) {
  const stored = isAgeBand(storedBand) ? storedBand : '';
  const sent = isAgeBand(sentBand) ? sentBand : '';
  const band = stored || sent;
  const save = !stored && !!sent;
  let code = null;
  if (!band) code = 'age_needed';
  else if (band === 'under13') code = 'age_blocked';
  else if (band === '13-17') code = 'minor_portraits_paused';
  return { band, save, code };
}

export const AGE_MESSAGES = {
  age_needed: 'Please tell us when you were born first.',
  age_blocked: "Hero portraits aren't available. You can keep playing every trail.",
  minor_portraits_paused: "Hero portraits for players under 18 aren't switched on yet. You can keep playing every trail.",
  age_check_unavailable: 'Hero portraits are unavailable right now. Please try again in a minute.'
};
