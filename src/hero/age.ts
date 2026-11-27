// The age screen's answer, as a band (27 Nov 2026).
//
// Hero portraits send the pet's photo and name to OpenAI, whose terms need a
// parent or guardian's consent for players under 18. Until that consent flow
// is built (and OpenAI has switched on zero data retention), portraits are
// for players 18 and over; everyone can play every trail.
//
// The game asks the birth month and year once, at the first portrait, turns
// them into a band here, and keeps only the band. The birth month and year
// are never saved or sent. The server keeps the first band it is sent and
// refuses portraits for any other band (backend/fetchDashAge.js).

export type AgeBand = 'under13' | '13-17' | '18+';

const AGE_KEY = 'fetch-dash-age';
const BANDS: readonly AgeBand[] = ['under13', '13-17', '18+'];

export function isAgeBand(v: unknown): v is AgeBand {
  return typeof v === 'string' && (BANDS as readonly string[]).includes(v);
}

/** Age in whole years from a birth month (1-12) and year. With no day asked,
 * a birthday this month counts as not yet reached (the younger age). */
export function ageFrom(month: number, year: number, now = new Date()): number {
  const m = now.getMonth() + 1;
  let age = now.getFullYear() - year;
  if (m <= month) age--;
  return age;
}

export function bandFromBirth(month: number, year: number, now = new Date()): AgeBand {
  const age = ageFrom(month, year, now);
  return age >= 18 ? '18+' : age >= 13 ? '13-17' : 'under13';
}

export function loadAgeBand(): AgeBand | undefined {
  try {
    const v = localStorage.getItem(AGE_KEY);
    return isAgeBand(v) ? v : undefined;
  } catch {
    return undefined;
  }
}

/** Keeps the band. The first answer stays, unless the server says otherwise
 * (it keeps the first band it was sent, and that one counts). */
export function saveAgeBand(band: AgeBand, fromServer = false): void {
  try {
    if (!fromServer && loadAgeBand()) return;
    localStorage.setItem(AGE_KEY, band);
  } catch {
    // Storage blocked: asked again next time; the server still holds the band
  }
}

/** Portraits are on for this band. */
export function portraitsAllowed(band: AgeBand | undefined): boolean {
  return band === '18+';
}

/** What the photo box says instead, for a band that can't make portraits. */
export function ageLine(band: AgeBand): string {
  return band === 'under13'
    ? "Hero portraits aren't available. You can keep playing every trail."
    : "Hero portraits for players under 18 aren't switched on yet. You can keep playing every trail.";
}
