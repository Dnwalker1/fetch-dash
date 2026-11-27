// backend/fetchDashRetention.js
// FETCH DASH: HOW LONG THE SERVER KEEPS A PLAYER'S DATA (26 Nov 2026).
//
// Plain functions with no Wix imports, so they can be tested off the site.
// Used by appBackend.js (to note when a player was last seen) and by
// fetchDashCleanup.js (the nightly job that deletes what has run out).
//
// What the server holds for a game player, and for how long:
//
//   Their photo and the 4K print file  deleted as soon as the portrait is
//                                       done (or failed). The game never
//                                       orders, so it needs neither.
//   The 1024 px portrait (preview)      deleted by the site's 7-day clean-up,
//                                       like every unordered design. The game
//                                       keeps its own copy on the phone.
//   FetchDashPlayers row: pet names,    DESIGNS_KEEP_DAYS after the player was
//   older IDs, anything left over       last seen, then trimmed to a bare count.
//   The bare count (how many free       COUNT_KEEP_DAYS after last seen, so a
//   portraits this phone has used)      reinstall can't reset the free 9. Then
//                                       the row is removed.
//
// If COUNT_KEEP_DAYS is not more than DESIGNS_KEEP_DAYS, there is no bare
// count stage: the whole row is removed after DESIGNS_KEEP_DAYS.

export const DAY_MS = 24 * 60 * 60 * 1000;
export const DESIGNS_KEEP_DAYS = 30;
export const COUNT_KEEP_DAYS = 365;
/** lastSeen is written at most this often, so polling doesn't mean writing. */
export const SEEN_EVERY_MS = DAY_MS;

const GAME_PREFIX = 'game_';

/** A time in ms from a Date, an ISO string or a number; NaN if none. */
export function toTime(v) {
  if (v instanceof Date) return v.getTime();
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return NaN;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : NaN;
}

function keepsCount() {
  return COUNT_KEEP_DAYS > DESIGNS_KEEP_DAYS;
}

/**
 * The fields that restart this player's clock, or null if lastSeen was
 * written less than a day ago. A player who comes back after being trimmed
 * to a bare count is a full player again (their count is kept).
 */
export function seenFields(row, now = Date.now()) {
  const last = toTime(row?.lastSeen);
  if (Number.isFinite(last) && last <= now && now - last < SEEN_EVERY_MS) return null;
  return {
    lastSeen: new Date(now),
    deleteAfter: new Date(now + DESIGNS_KEEP_DAYS * DAY_MS),
    countOnly: false
  };
}

/**
 * What the nightly job does with a player row:
 *   { action: 'wait',    fields }  not due yet: just move deleteAfter
 *   { action: 'trim',    fields }  delete the designs and files, keep the count
 *   { action: 'remove' }          delete the designs and files, then the row
 * A row from before lastSeen existed is timed from its last update.
 */
export function stalePlan(row, now = Date.now()) {
  let base = toTime(row?.lastSeen);
  if (!Number.isFinite(base)) base = toTime(row?._updatedDate);
  if (!Number.isFinite(base)) base = now;
  const age = now - base;
  const lastSeen = new Date(base);

  if (age >= DESIGNS_KEEP_DAYS * DAY_MS) {
    if (!keepsCount() || age >= COUNT_KEEP_DAYS * DAY_MS) return { action: 'remove' };
    if (row?.countOnly === true) {
      return { action: 'wait', fields: { lastSeen, deleteAfter: new Date(base + COUNT_KEEP_DAYS * DAY_MS) } };
    }
    return { action: 'trim', fields: trimmedFields(base) };
  }
  return {
    action: 'wait',
    fields: { lastSeen, deleteAfter: new Date(base + DESIGNS_KEEP_DAYS * DAY_MS) }
  };
}

/**
 * A player row cut down to its count. The design IDs stay (they are random
 * Wix IDs of designs already deleted) so the 9 still holds; with no pet names
 * left, fetchDashPets.js counts them as unnamed, which uses up the 9 but not
 * a pet's place.
 */
export function trimmedFields(lastSeenMs) {
  return {
    designPets: '{}',
    mergedFrom: '[]',
    legacyId: '',
    idKind: '',
    countOnly: true,
    lastSeen: new Date(lastSeenMs),
    deleteAfter: new Date(lastSeenMs + COUNT_KEEP_DAYS * DAY_MS)
  };
}

/** Only game rows are ever touched by the game's clean-up. */
export function isGameVisitorId(visitorId) {
  return String(visitorId || '').startsWith(GAME_PREFIX) && String(visitorId).length > GAME_PREFIX.length;
}

/** A design on an order is never deleted here (the game can't order; this is a guard). */
export function isOnAnOrder(d) {
  const sent = Array.isArray(d?.printfulSentLines)
    ? d.printfulSentLines.length
    : String(d?.printfulSentLines || '').trim().length;
  return d?.status === 'ordered' || !!d?.orderNumber || !!d?.orderId || !!sent;
}

// "https://static.wixstatic.com/media/94607f_abc~mv2.png" -> "94607f_abc~mv2.png"
// "wix:image://v1/94607f_abc~mv2.jpg/name.jpg#..."       -> "94607f_abc~mv2.jpg"
// Same as fileIdOf in petDesigns.js.
export function fileIdOf(url) {
  const s = String(url || '').trim();
  let m = s.match(/static\.wixstatic\.com\/media\/([^/?#]+)/);
  if (m) return m[1];
  m = s.match(/^wix:(?:image|vector|video|document):\/\/v1\/([^/#]+)/);
  return m ? m[1] : null;
}

/** Every Media Manager file a design row points at. */
export function designFileIds(d) {
  return [...new Set([d?.originalPhotoUrl, d?.generatedArtUrl, d?.previewArtUrl].map(fileIdOf).filter(Boolean))];
}

/** A finished design's statuses. 'pending' is the only one still working. */
export function isFinished(d) {
  return !!d?.status && d.status !== 'pending';
}

/** A design still 'pending' this long after it was made was abandoned (a
 * portrait takes a minute or two), so its photo goes too. */
export const STUCK_AFTER_MS = DAY_MS;

export function isAbandoned(d, now = Date.now()) {
  const made = toTime(d?._createdDate);
  return d?.status === 'pending' && Number.isFinite(made) && now - made >= STUCK_AFTER_MS;
}

/**
 * A deletion request's game code -> how to find the player, or null if it
 * isn't one. The game shows the first 8 characters of its ID (gameCode() in
 * src/hero/api.ts); a full ID, with or without "game_", also works.
 *   { exact: 'game_<id>' }  or  { prefix: 'game_<8 chars>' }
 */
export function playerLookup(code) {
  const s = String(code || '').trim().toLowerCase().replace(/^game_/, '');
  if (/^[0-9a-f]{8}$/.test(s)) return { prefix: GAME_PREFIX + s };
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s)) return { exact: GAME_PREFIX + s };
  return null;
}

/** The older game IDs merged into a player row (mergedFrom is JSON text). */
export function mergedIdsOf(row) {
  try {
    const v = JSON.parse(row?.mergedFrom || '[]');
    return Array.isArray(v) ? v.filter(isGameVisitorId) : [];
  } catch {
    return [];
  }
}

/**
 * The files a finished (or abandoned) game design no longer needs: the
 * player's photo and the 4K print file. Never the preview, even where a row points two fields at
 * the same file.
 */
export function filesToTrim(d, now = Date.now()) {
  if ((!isFinished(d) && !isAbandoned(d, now)) || isOnAnOrder(d)) return [];
  const keep = fileIdOf(d?.previewArtUrl);
  return [...new Set([d?.originalPhotoUrl, d?.generatedArtUrl].map(fileIdOf).filter(id => id && id !== keep))];
}
