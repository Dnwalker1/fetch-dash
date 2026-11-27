// Run with: npm run test:wix
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  DAY_MS, DESIGNS_KEEP_DAYS, COUNT_KEEP_DAYS, seenFields, stalePlan, filesToTrim, fileIdOf, designFileIds, playerLookup
} from 'backend/fetchDashRetention';
import { tallyPets, portraitRefusal } from 'backend/fetchDashPets';
import { deleteGamePlayerData, deleteStaleInstalls, dryRunFetchDashCleanup, trimGameDesign } from 'backend/fetchDashCleanup';
import { db } from 'wix-data';
import { store } from '@wix/media';

const NOW = Date.UTC(2027, 0, 15, 8);
const daysAgo = (n) => new Date(NOW - n * DAY_MS);
const url = (id) => `https://static.wixstatic.com/media/${id}`;
const wixUrl = (id) => `wix:image://v1/${id}/${id}#originWidth=1024`;

test('lastSeen is written at most once a day', () => {
  assert.equal(seenFields({ lastSeen: new Date(NOW - 3600e3) }, NOW), null);
  const f = seenFields({ lastSeen: new Date(NOW - 2 * DAY_MS) }, NOW);
  assert.equal(f.lastSeen.getTime(), NOW);
  assert.equal(f.deleteAfter.getTime(), NOW + DESIGNS_KEEP_DAYS * DAY_MS);
  assert.equal(f.countOnly, false);
  assert.ok(seenFields(null, NOW), 'a new player gets a clock');
  assert.ok(seenFields({ lastSeen: new Date(NOW + DAY_MS) }, NOW), 'a clock in the future is reset');
});

test('stale plan: wait, trim to a count, then remove', () => {
  assert.equal(stalePlan({ lastSeen: daysAgo(10) }, NOW).action, 'wait');
  assert.equal(stalePlan({ lastSeen: daysAgo(10) }, NOW).fields.deleteAfter.getTime(), NOW + 20 * DAY_MS);
  const trim = stalePlan({ lastSeen: daysAgo(31) }, NOW);
  assert.equal(trim.action, 'trim');
  assert.equal(trim.fields.designPets, '{}');
  assert.equal(trim.fields.countOnly, true);
  assert.equal(trim.fields.deleteAfter.getTime(), NOW - 31 * DAY_MS + COUNT_KEEP_DAYS * DAY_MS);
  assert.equal(stalePlan({ lastSeen: daysAgo(31), countOnly: true }, NOW).action, 'wait');
  assert.equal(stalePlan({ lastSeen: daysAgo(COUNT_KEEP_DAYS + 1), countOnly: true }, NOW).action, 'remove');
  assert.equal(stalePlan({ _updatedDate: daysAgo(40) }, NOW).action, 'trim', 'old rows are timed from their last update');
});

test('a trimmed player still has used up the 9', () => {
  const nine = Array.from({ length: 9 }, (_, i) => `d${i}`);
  assert.equal(portraitRefusal(tallyPets(nine, {}), 'Chewy'), 'limit_game');
  const three = ['a', 'b', 'c'];
  assert.equal(portraitRefusal(tallyPets(three, {}), 'Chewy'), null, 'unnamed ones use the 9, not a pet place');
});

test('file IDs and what a finished game design can lose', () => {
  assert.equal(fileIdOf(url('94607f_a~mv2.png')), '94607f_a~mv2.png');
  assert.equal(fileIdOf(wixUrl('94607f_b~mv2.jpg')), '94607f_b~mv2.jpg');
  assert.equal(fileIdOf('nope'), null);
  const d = { status: 'ready', originalPhotoUrl: url('p'), generatedArtUrl: url('g'), previewArtUrl: url('v') };
  assert.deepEqual(filesToTrim(d).sort(), ['g', 'p']);
  assert.deepEqual(designFileIds(d).sort(), ['g', 'p', 'v']);
  assert.deepEqual(filesToTrim({ ...d, status: 'pending' }), [], 'never while it is still being made');
  assert.deepEqual(filesToTrim({ ...d, generatedArtUrl: url('v') }), ['p'], 'never the preview');
  assert.deepEqual(filesToTrim({ ...d, status: 'ordered' }), [], 'never an ordered design');
  const old = { ...d, status: 'pending', _createdDate: daysAgo(2) };
  assert.deepEqual(filesToTrim(old, NOW).sort(), ['g', 'p'], 'abandoned a day later');
  assert.deepEqual(filesToTrim({ ...old, _createdDate: new Date(NOW - 3600e3) }, NOW), [], 'not while it may still finish');
});

test('game codes', () => {
  assert.deepEqual(playerLookup('AB12CD34'), { prefix: 'game_ab12cd34' });
  assert.deepEqual(playerLookup(' game_ab12cd34 '), { prefix: 'game_ab12cd34' });
  const full = 'ab12cd34-0000-4000-8000-000000000000';
  assert.deepEqual(playerLookup(full), { exact: `game_${full}` });
  for (const bad of ['', 'AB12', 'visitor-abc', 'zz12cd34', null]) assert.equal(playerLookup(bad), null);
});

// ---------------------------------------------------------------------------
// The nightly job against a pretend Wix site
// ---------------------------------------------------------------------------

function seed() {
  db.clear();
  store.files.clear(); store.trash.clear(); store.refuse.clear();
  const players = new Map();
  const designs = new Map();
  db.set('FetchDashPlayers', players);
  db.set('PetDesigns', designs);
  const design = (id, visitorId, status, extra = {}) => {
    const d = { _id: id, visitorId, status, _createdDate: daysAgo(3),
      originalPhotoUrl: wixUrl(`${id}-photo`), generatedArtUrl: url(`${id}-print`), previewArtUrl: url(`${id}-preview`), ...extra };
    for (const f of designFileIds(d)) store.files.add(f);
    designs.set(id, d);
  };
  // Seen yesterday: keep everything
  players.set('game_active', { _id: 'game_active', countedDesigns: '["a1"]', designPets: '{"a1":"Chewy"}', lastSeen: daysAgo(1), deleteAfter: new Date(NOW + 29 * DAY_MS) });
  design('a1', 'game_active', 'ready');
  // Not seen for 40 days: designs go, the count stays
  players.set('game_gone', { _id: 'game_gone', countedDesigns: '["g1","g2"]', designPets: '{"g1":"Luna","g2":"Luna"}', mergedFrom: '["game_old"]', lastSeen: daysAgo(40), deleteAfter: daysAgo(10) });
  design('g1', 'game_gone', 'ready');
  design('g2', 'game_gone', 'blocked', { generatedArtUrl: '', previewArtUrl: '' });
  // A year and more: removed
  players.set('game_ancient', { _id: 'game_ancient', countedDesigns: '["x"]', countOnly: true, lastSeen: daysAgo(400), deleteAfter: daysAgo(35) });
  // From before lastSeen existed, last updated 50 days ago
  players.set('game_legacy', { _id: 'game_legacy', countedDesigns: '["l1"]', designPets: '{"l1":"Rex"}', _updatedDate: daysAgo(50) });
  design('l1', 'game_legacy', 'ready');
  // Shop and app designs, and a game design on an order: never touched
  design('s1', 'visitor-abc', 'ready');
  design('app1', 'app_device', 'ready');
  design('o1', 'game_gone', 'ordered');
  // Closed mid-wait: finished, photo still there
  design('w1', 'game_active', 'error');
  // Still being made
  design('p1', 'game_active', 'pending', { _createdDate: new Date(NOW - 60e3) });
  // Abandoned: still 'pending' 3 days later
  design('p2', 'game_active', 'pending');
  return { players, designs };
}

beforeEach(() => { seed(); });

test('dry run changes nothing', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const before = JSON.stringify([...db.get('FetchDashPlayers').values(), ...db.get('PetDesigns').values()]);
  const files = store.files.size;
  const r = await dryRunFetchDashCleanup();
  assert.equal(r.dryRun, true);
  assert.equal(r.playersTrimmed, 2);
  assert.equal(r.playersRemoved, 1);
  assert.equal(JSON.stringify([...db.get('FetchDashPlayers').values(), ...db.get('PetDesigns').values()]), before);
  assert.equal(store.files.size, files);
});

test('the nightly run deletes permanently and keeps what it should', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const r = await deleteStaleInstalls();
  const players = db.get('FetchDashPlayers');
  const designs = db.get('PetDesigns');

  // Active player untouched, apart from the finished design's photo and print file
  assert.equal(players.get('game_active').designPets, '{"a1":"Chewy"}');
  assert.ok(designs.has('a1'));
  assert.equal(designs.get('a1').originalPhotoUrl, '');
  assert.equal(designs.get('a1').generatedArtUrl, '');
  assert.ok(store.files.has('a1-preview'), 'the preview stays for the 7-day clean-up');
  assert.ok(!store.files.has('a1-photo') && !store.files.has('a1-print'));
  assert.equal(designs.get('w1').originalPhotoUrl, '', 'a game closed mid-wait loses its photo too');
  assert.ok(store.files.has('p1-photo'), 'a design still being made keeps its photo');
  assert.ok(!store.files.has('p2-photo') && store.files.has('p2-preview'), 'an abandoned one loses its photo, not its preview');

  // 40 days unseen: trimmed to a count
  const gone = players.get('game_gone');
  assert.equal(gone.countOnly, true);
  assert.equal(gone.designPets, '{}');
  assert.equal(gone.mergedFrom, '[]');
  assert.equal(gone.countedDesigns, '["g1","g2"]');
  assert.ok(gone.deleteAfter.getTime() > NOW);
  assert.ok(!designs.has('g1') && !designs.has('g2'));
  assert.ok(!store.files.has('g1-preview') && !store.files.has('g1-photo') && !store.files.has('g1-print'));
  assert.ok(designs.has('o1') && store.files.has('o1-photo'), 'an ordered design is never touched');

  // A year unseen: removed
  assert.ok(!players.has('game_ancient'));

  // Legacy row: given a clock from its last update, then trimmed in the same run
  assert.equal(players.get('game_legacy').countOnly, true);
  assert.ok(!designs.has('l1'));

  // Shop and app designs untouched
  for (const id of ['s1', 'app1']) {
    assert.ok(designs.has(id));
    assert.ok(store.files.has(`${id}-photo`) && store.files.has(`${id}-preview`));
  }

  // Nothing went to the Trash
  assert.equal(store.trash.size, 0);
  assert.equal(r.failed, 0);

  // A second run the same night finds nothing more to do
  const again = await deleteStaleInstalls();
  assert.equal(again.playersTrimmed + again.playersRemoved + again.designRowsDeleted + again.designsTrimmed, 0);
});

test('a file that cannot be deleted keeps its row for tomorrow', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  store.refuse.add('g1-preview');
  const r = await deleteStaleInstalls();
  assert.equal(r.failed, 1);
  const designs = db.get('PetDesigns');
  assert.ok(designs.has('g1'), 'row stays so its files can be found again');
  assert.equal(db.get('FetchDashPlayers').get('game_gone').countOnly, undefined, 'player not trimmed yet');
  assert.ok(db.get('FetchDashPlayers').get('game_gone').deleteAfter.getTime() < NOW, 'still due');
});

test('trimGameDesign only touches game designs', async () => {
  const designs = db.get('PetDesigns');
  assert.equal(await trimGameDesign(designs.get('s1')), 0);
  assert.ok(store.files.has('s1-photo'));
  assert.equal(await trimGameDesign(designs.get('a1')), 2);
  assert.equal(designs.get('a1').originalPhotoUrl, '');
});

test('a deletion request removes one player and nothing else', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const players = db.get('FetchDashPlayers');
  const designs = db.get('PetDesigns');
  const id = 'game_ab12cd34-0000-4000-8000-000000000001';
  players.set(id, { _id: id, countedDesigns: '["k1","k2"]', designPets: '{"k1":"Bo"}', mergedFrom: '["game_oldweb"]', lastSeen: daysAgo(2), deleteAfter: daysAgo(-28) });
  players.set('game_oldweb', { _id: 'game_oldweb', countedDesigns: '["k3"]' });
  const add = (dId, visitorId, status) => {
    const d = { _id: dId, visitorId, status, _createdDate: daysAgo(1), originalPhotoUrl: '', generatedArtUrl: '', previewArtUrl: url(`${dId}-preview`) };
    store.files.add(`${dId}-preview`); designs.set(dId, d);
  };
  add('k1', id, 'ready'); add('k2', id, 'blocked'); add('k3', 'game_oldweb', 'ready'); add('k4', id, 'ordered');

  // A code shared by two players is refused
  const twin = 'game_ab12cd34-0000-4000-8000-000000000002';
  players.set(twin, { _id: twin, countedDesigns: '[]' });
  assert.match((await deleteGamePlayerData('AB12CD34', { dryRun: false })).refused, /more than one/);
  assert.ok(players.has(id) && designs.has('k1'));
  players.delete(twin);

  const dry = await deleteGamePlayerData('AB12CD34');
  assert.equal(dry.dryRun, true);
  assert.equal(dry.designRowsDeleted, 3);
  assert.equal(dry.playerRows, 2);
  assert.ok(players.has(id) && designs.has('k1') && store.files.has('k1-preview'), 'dry run deletes nothing');

  const r = await deleteGamePlayerData('ab12cd34', { dryRun: false });
  assert.equal(r.found, 1);
  assert.equal(r.orderedKept, 1);
  assert.ok(!players.has(id) && !players.has('game_oldweb'));
  for (const k of ['k1', 'k2', 'k3']) assert.ok(!designs.has(k) && !store.files.has(`${k}-preview`));
  assert.ok(designs.has('k4'), 'a design on an order stays');
  assert.ok(players.has('game_active') && designs.has('a1') && designs.has('s1'), 'nobody else touched');
  assert.equal(store.trash.size, 0);

  assert.equal((await deleteGamePlayerData('not-a-code', { dryRun: false })).refused, 'not a game code');
});
