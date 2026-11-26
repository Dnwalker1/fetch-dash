// backend/fetchDashCleanup.js
// FETCH DASH: THE NIGHTLY CLEAN-UP OF GAME PLAYERS (26 Nov 2026).
//
// Run by backend/jobs.config (one entry added beside the site's existing
// nightly clean-up; see PASTE-STEPS.md). The rules and numbers are in
// backend/fetchDashRetention.js.
//
// Two parts:
//
//   1. trimFinishedGameDesigns()  a game design that is done (or failed) and
//      still has the player's photo or its 4K print file: PERMANENTLY delete
//      those files and clear them from the row. Normally appBackend.js does
//      this the moment the game sees the result; this catches a game that was
//      closed mid-wait.
//
//   2. deleteStaleInstalls()  FetchDashPlayers rows past their deleteAfter:
//      PERMANENTLY delete every file of that player's remaining game designs,
//      remove those PetDesigns rows, then trim the player row to a bare count
//      or remove it.
//
// Every file delete is permanent (no Trash): a file in the Media Manager's
// Trash is still kept, and can still be served. A row whose files couldn't be
// deleted stays, so it is found and tried again the next night.
//
// Only rows whose visitorId starts with "game_" are ever touched, and never a
// design on an order. The site's own 7-day clean-up (cleanup.js,
// petDesigns.js) still runs for every unordered design, game ones included.
//
// Logs counts only, never IDs or names. Both take { dryRun: true } to report
// what they WOULD do: run dryRunFetchDashCleanup() from the Code panel.

import wixData from 'wix-data';
import { files as mediaFiles } from '@wix/media';
import { auth as mediaAuth } from '@wix/essentials';
import {
  designFileIds, filesToTrim, isGameVisitorId, isOnAnOrder, stalePlan
} from 'backend/fetchDashRetention';

const PLAYERS = 'FetchDashPlayers';
const DESIGNS = 'PetDesigns';
const PAGE = 50;
const PLAYERS_PER_RUN = 500;
const TRIMS_PER_RUN = 500;
const FINISHED = ['ready', 'flagged', 'blocked', 'error', 'unclean', 'failed'];

/** The Velo job (jobs.config). */
export async function deleteStaleInstalls(options = {}) {
  const trimmed = await trimFinishedGameDesigns(options);
  const players = await cleanStalePlayers(options);
  const report = { ...players, designsTrimmed: trimmed.designs, filesDeleted: players.filesDeleted + trimmed.filesDeleted };
  console.log(`Fetch Dash clean-up${options.dryRun === true ? ' (dry run)' : ''}: ${JSON.stringify(report)}`);
  return report;
}

/** What tonight's run would do, without changing anything. */
export async function dryRunFetchDashCleanup() {
  return deleteStaleInstalls({ dryRun: true });
}

// ---------------------------------------------------------------------------
// 1. Photos and print files of finished game designs
// ---------------------------------------------------------------------------

export async function trimFinishedGameDesigns(options = {}) {
  const dryRun = options.dryRun === true;
  const report = { designs: 0, filesDeleted: 0, failed: 0 };
  let skip = 0;
  let examined = 0;
  while (examined < TRIMS_PER_RUN) {
    const res = await wixData.query(DESIGNS)
      .startsWith('visitorId', 'game_')
      .hasSome('status', FINISHED)
      .ascending('_createdDate')
      .skip(skip)
      .limit(100)
      .find({ suppressAuth: true });
    if (!res.items.length) break;
    for (const d of res.items) {
      examined++;
      const ids = isGameVisitorId(d.visitorId) ? filesToTrim(d) : [];
      if (!ids.length) { skip++; continue; }
      if (dryRun) { report.designs++; report.filesDeleted += ids.length; skip++; continue; }
      try {
        await trimDesignFiles(d, ids);
        report.designs++;
        report.filesDeleted += ids.length;
      } catch (e) {
        report.failed++;
        console.warn(`Fetch Dash clean-up: a finished design kept its files for now: ${e.message}`);
      }
      skip++;   // still matches the query (it stays a game design), so step over it
    }
    if (!res.hasNext()) break;
  }
  return report;
}

/**
 * Permanently delete a finished game design's photo and print file, then
 * clear them from the row. Used by appBackend.js the moment the game sees the
 * result, and by the nightly job.
 */
export async function trimGameDesign(d) {
  if (!isGameVisitorId(d?.visitorId)) return 0;
  const ids = filesToTrim(d);
  if (!ids.length) return 0;
  await trimDesignFiles(d, ids);
  return ids.length;
}

async function trimDesignFiles(d, ids) {
  await deleteFilesForever(ids);
  const fresh = await wixData.get(DESIGNS, d._id, { suppressAuth: true });
  if (!fresh) return;
  await wixData.update(DESIGNS, { ...fresh, originalPhotoUrl: '', generatedArtUrl: '' }, { suppressAuth: true });
}

// ---------------------------------------------------------------------------
// 2. Players not seen for a while
// ---------------------------------------------------------------------------

async function cleanStalePlayers(options = {}) {
  const dryRun = options.dryRun === true;
  const now = Date.now();
  const report = {
    dryRun, clocksSet: 0, playersTrimmed: 0, playersRemoved: 0,
    designRowsDeleted: 0, filesDeleted: 0, failed: 0
  };

  // Rows from before lastSeen existed get a clock first, so they're never
  // kept for ever by accident.
  // In a dry run nothing is written, so rows that would be due at once are
  // handed back and counted here.
  const clocks = await setMissingClocks(now, dryRun);
  report.clocksSet = clocks.set;
  for (const row of clocks.dueNow) await countDryRun(row, stalePlan(row, now), report);

  let skip = 0;
  let examined = 0;
  while (examined < PLAYERS_PER_RUN) {
    const res = await wixData.query(PLAYERS)
      .lt('deleteAfter', new Date(now))
      .ascending('deleteAfter')
      .skip(skip)
      .limit(PAGE)
      .find({ suppressAuth: true });
    if (!res.items.length) break;

    for (const row of res.items) {
      examined++;
      const plan = stalePlan(row, now);
      if (dryRun) {
        await countDryRun(row, plan, report);
        skip++;
        continue;
      }
      try {
        if (plan.action === 'wait') {
          await wixData.update(PLAYERS, { ...row, ...plan.fields }, { suppressAuth: true });
          continue;
        }
        const gone = await deleteGameDesigns(row._id);
        report.designRowsDeleted += gone.rows;
        report.filesDeleted += gone.files;
        if (plan.action === 'trim') {
          await wixData.update(PLAYERS, { ...row, ...plan.fields }, { suppressAuth: true });
          report.playersTrimmed++;
        } else {
          await wixData.remove(PLAYERS, row._id, { suppressAuth: true });
          report.playersRemoved++;
        }
      } catch (e) {
        // The row keeps its old deleteAfter, so it's tried again tomorrow.
        report.failed++;
        skip++;
        console.warn(`Fetch Dash clean-up: a player was kept for now: ${e.message}`);
      }
    }
    if (!res.hasNext()) break;
  }
  return report;
}

async function countDryRun(row, plan, report) {
  if (plan.action === 'wait') return;
  const designs = await gameDesignsOf(row._id);
  report.designRowsDeleted += designs.length;
  report.filesDeleted += designs.reduce((n, d) => n + designFileIds(d).length, 0);
  if (plan.action === 'trim') report.playersTrimmed++;
  else report.playersRemoved++;
}

async function setMissingClocks(now, dryRun) {
  let n = 0;
  const dueNow = [];
  for (let page = 0; page < PLAYERS_PER_RUN / PAGE; page++) {
    const res = await wixData.query(PLAYERS)
      .isEmpty('deleteAfter')
      .skip(dryRun ? page * PAGE : 0)
      .limit(PAGE)
      .find({ suppressAuth: true });
    if (!res.items.length) break;
    for (const row of res.items) {
      // Timed from the row's last update. A row already past its time is
      // handled by the main loop below, in the same run.
      const plan = stalePlan({ ...row, countOnly: false }, now);
      const fields = plan.action === 'wait' ? plan.fields : { lastSeen: new Date(row._updatedDate || now), deleteAfter: new Date(now - 1) };
      n++;
      if (!dryRun) await wixData.update(PLAYERS, { ...row, ...fields }, { suppressAuth: true });
      else if (plan.action !== 'wait') dueNow.push(row);
    }
    if (!res.hasNext()) break;
  }
  return { set: n, dueNow };
}

/** This player's game designs that may be deleted (never one on an order). */
async function gameDesignsOf(visitorId) {
  if (!isGameVisitorId(visitorId)) return [];
  const res = await wixData.query(DESIGNS)
    .eq('visitorId', visitorId)
    .limit(1000)
    .find({ suppressAuth: true });
  return res.items.filter(d => d.visitorId === visitorId && !isOnAnOrder(d));
}

/** Files first, then the row: a row is only removed once its files are gone. */
async function deleteGameDesigns(visitorId) {
  const out = { rows: 0, files: 0 };
  for (const d of await gameDesignsOf(visitorId)) {
    out.files += await deleteFilesForever(designFileIds(d));
    await wixData.remove(DESIGNS, d._id, { suppressAuth: true });
    out.rows++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Permanent file delete (same as deleteFilesForever in petDesigns.js)
// ---------------------------------------------------------------------------

/**
 * Permanently delete Media Manager files: { permanent: true }, never the
 * Trash. If the batch is refused, tries them one at a time and skips any that
 * are already gone. Throws if a file is there but couldn't be deleted.
 */
export async function deleteFilesForever(fileIds) {
  const ids = [...new Set((fileIds || []).filter(Boolean))];
  if (!ids.length) return 0;
  const bulkDelete = mediaAuth.elevate(mediaFiles.bulkDeleteFiles);   // elevated in here, never at load
  try {
    await bulkDelete(ids, { permanent: true });
    return ids.length;
  } catch (e) {
    let n = 0;
    for (const id of ids) {
      try {
        await bulkDelete([id], { permanent: true });
        n++;
      } catch (one) {
        if (!/not.?found|does not exist|404/i.test(String(one.message))) throw one;
      }
    }
    return n;
  }
}
