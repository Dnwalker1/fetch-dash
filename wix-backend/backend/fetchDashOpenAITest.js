/* global globalThis */
// backend/fetchDashOpenAITest.js
// FETCH DASH: TRYING OPENAI FROM THE CODE PANEL (27 Nov 2026).
//
// The Code panel gives up on a function after about 14 seconds, and a
// picture takes OpenAI 30 seconds or more, so a portrait can't be painted
// inside one test run. Instead:
//
//   1. testOpenAIKey()            a few seconds: is the key there, and does
//                                 OpenAI answer? No picture, almost free.
//   2. startOpenAITest(photoUrl)  starts a real game portrait from a photo
//                                 already in the Media Manager and returns at
//                                 once with its designId. The portrait is
//                                 made in the background, the same way the
//                                 game's are (photo check, picture, art check).
//   3. checkOpenAITest(designId)  run 2 or 3 minutes later: says how it went
//                                 and gives the portrait's web address.
//
// startOpenAITest works on a COPY of the photo (in app-uploads), because a
// game design's photo is deleted for good once the portrait is made. The
// test design belongs to "game_openai-test" and is cleaned up like any other
// game design. It costs one picture.
//
// Needs the aiDesign.web.js edits in place: without them the test portrait
// is made by Gemini, as before.

import { mediaManager } from 'wix-media-backend';
import { startDesignCore } from 'backend/aiDesign.web';
import { getDesignRecord, toPublicImageUrl } from 'backend/petDesigns';
import { callOpenAIAsGemini, designKeyFor, OPENAI_CHECK_MODEL, OPENAI_IMAGE_MODEL } from 'backend/fetchDashOpenAI';

const TEST_VISITOR = 'game_openai-test';

/** Step 1: the key and the check model, with a tiny text-only question. */
export async function testOpenAIKey() {
  let key;
  try {
    key = await designKeyFor(TEST_VISITOR);
  } catch (e) {
    return { ok: false, problem: e.message };
  }
  const started = Date.now();
  const r = await callOpenAIAsGemini('check', key, { contents: [{ parts: [{ text: 'Reply as JSON: {"ok": true}' }] }] });
  const json = await r.json();
  return {
    ok: r.ok,
    model: OPENAI_CHECK_MODEL,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    answer: json?.candidates?.[0]?.content?.parts?.[0]?.text || '',
    problem: json?.error?.message || ''
  };
}

/** Step 2: start one real game portrait from a copy of a Media Manager photo. */
export async function startOpenAITest(photoUrl) {
  const resp = await globalThis.fetch(toPublicImageUrl(String(photoUrl || '').trim()));
  if (!resp.ok) return { ok: false, problem: `Couldn't load that photo (HTTP ${resp.status}). Use its static.wixstatic.com address.` };
  const buffer = Buffer.from(await resp.arrayBuffer());
  const mimeType = resp.headers.get('content-type') || 'image/jpeg';
  const copy = await mediaManager.upload(
    '/app-uploads',
    buffer,
    `openai-test-${Date.now()}.${/png/.test(mimeType) ? 'png' : 'jpg'}`,
    { mediaOptions: { mimeType, mediaType: 'image' } }
  );
  const r = await startDesignCore(copy.fileUrl, 'arcadeHero', { visitorId: TEST_VISITOR }, '', false, '', '', { game: true });
  if (!r.ok) return { ok: false, problem: r.reason || r.step || 'the design did not start' };
  return {
    ok: true,
    designId: r.designRecordId,
    model: OPENAI_IMAGE_MODEL,
    next: 'Wait 2 or 3 minutes, then run checkOpenAITest with this designId.'
  };
}

/** Step 3: how the test portrait went. */
export async function checkOpenAITest(designId) {
  const d = await getDesignRecord(String(designId || '').trim());
  if (!d) return { ok: false, problem: 'No design with that ID (or the 7-day clean-up removed it).' };
  const status = d.status;
  return {
    status,
    done: status !== 'pending',
    worked: status === 'ready' || status === 'flagged',
    note: d.moderationNote || '',
    portrait: d.previewArtUrl ? toPublicImageUrl(d.previewArtUrl) : '',
    minutes: Math.round((Date.now() - new Date(d._createdDate).getTime()) / 6000) / 10
  };
}
