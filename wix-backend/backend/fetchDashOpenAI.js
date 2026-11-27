/* global globalThis */
// backend/fetchDashOpenAI.js
// FETCH DASH: GAME PORTRAITS ARE PAINTED BY OPENAI, NOT GEMINI (27 Nov 2026).
//
// That first line is for Wix's publish-time code checker (same as
// aiDesign.web.js): it says globalThis is a real name. Leave it at the top.
//
// Why: Google's Gemini terms don't allow it in an app likely to be used by
// anyone under 18, and Fetch Dash is a 13+ game. Don chose OpenAI for the
// game (27 Nov 2026). Design Your Pet and the website stay on Gemini: nothing
// here changes them.
//
// How it fits in with the least change to aiDesign.web.js: every model call
// there goes through callGemini(model, apiKey, body). For a game design the
// key it is handed comes from designKeyFor(), which for a "game_" visitor is
// "openai:" + the OpenAI key. callGemini then hands the call to
// callOpenAIAsGemini(), which sends the same request to OpenAI and gives back
// an answer shaped like Gemini's, so the rest of aiDesign.web.js (the photo
// check, the art check, the retries, saving the files) runs unchanged.
//
//   The picture  POST /v1/images/edits, model OPENAI_IMAGE_MODEL, pinned on
//                every call: it is on OpenAI's zero data retention list and
//                the endpoint's default model is not. 1024 x 1024, the size
//                the game uses (the game never orders, so no print file).
//   The checks   POST /v1/responses, model OPENAI_CHECK_MODEL, JSON answer,
//                store: false (nothing kept for later).
//
// Nothing that identifies the player (no device ID, no game ID) is sent.
// The pet's photo, the style examples and the prompt (with the pet's name) are.
//
// Needs the secret OPENAI_API_KEY in the Secrets Manager.

import { getSecret } from 'wix-secrets-backend';

export const OPENAI_IMAGE_MODEL = 'gpt-image-2.5-sunburst-2026-09-08';
export const OPENAI_CHECK_MODEL = 'gpt-6-luna';
export const OPENAI_IMAGE_SIZE = '1024x1024';
export const OPENAI_IMAGE_QUALITY = 'medium';

const API = 'https://api.openai.com/v1';
const KEY_PREFIX = 'openai:';
const GAME_PREFIX = 'game_';

/** The key aiDesign.web.js should use for this visitor's design. */
export async function designKeyFor(visitorId) {
  if (String(visitorId || '').startsWith(GAME_PREFIX)) {
    const key = String(await getSecret('OPENAI_API_KEY') || '').trim();
    if (!key) throw new Error('The OPENAI_API_KEY secret is missing, so game portraits are off.');
    return KEY_PREFIX + key;
  }
  return String(await getSecret('GEMINI_API_KEY') || '').trim();
}

export function isOpenAIKey(apiKey) {
  return typeof apiKey === 'string' && apiKey.startsWith(KEY_PREFIX);
}

// ---------------------------------------------------------------------------
// Turning a Gemini request into OpenAI's, and the answer back
// ---------------------------------------------------------------------------

function inlineOf(part) {
  const d = part?.inlineData || part?.inline_data;
  if (!d?.data) return null;
  return { mimeType: d.mimeType || d.mime_type || 'image/png', data: d.data };
}

/**
 * A Gemini body's parts, in order, as a prompt and a list of images. Where a
 * picture sat between two bits of text the prompt says "[Image n]", so lines
 * like "the next 2 images are style examples" still point at the right ones.
 */
export function splitGeminiBody(body) {
  const parts = (body?.contents || []).flatMap(c => c?.parts || []);
  const images = [];
  const lines = [];
  for (const p of parts) {
    const img = inlineOf(p);
    if (img) { images.push(img); lines.push(`[Image ${images.length}]`); }
    else if (typeof p?.text === 'string' && p.text.trim()) lines.push(p.text.trim());
  }
  const lead = images.length ? `The ${images.length} attached image${images.length > 1 ? 's are' : ' is'} numbered in the order they are attached.\n\n` : '';
  return { prompt: lead + lines.join('\n\n'), images };
}

/** The checks' request for /v1/responses. */
export function checkRequest(body, model = OPENAI_CHECK_MODEL) {
  const parts = (body?.contents || []).flatMap(c => c?.parts || []);
  const content = [{ type: 'input_text', text: 'Answer with one JSON object only.' }];
  for (const p of parts) {
    const img = inlineOf(p);
    if (img) content.push({ type: 'input_image', image_url: `data:${img.mimeType};base64,${img.data}` });
    else if (typeof p?.text === 'string' && p.text.trim()) content.push({ type: 'input_text', text: p.text });
  }
  return { model, input: [{ role: 'user', content }], text: { format: { type: 'json_object' } }, store: false };
}

/** The text of a /v1/responses answer, or null if it refused or said nothing. */
export function responseText(json) {
  for (const item of json?.output || []) {
    if (item?.type !== 'message') continue;
    for (const c of item.content || []) {
      if (c?.type === 'output_text' && typeof c.text === 'string') return c.text;
    }
  }
  return typeof json?.output_text === 'string' ? json.output_text : null;
}

/** A multipart/form-data body for /v1/images/edits, built by hand. */
export function imageEditForm(prompt, images, opts = {}) {
  const boundary = `----fetchdash${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const chunks = [];
  const field = (name, value) => chunks.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  field('model', opts.model || OPENAI_IMAGE_MODEL);
  field('prompt', prompt);
  field('size', opts.size || OPENAI_IMAGE_SIZE);
  field('quality', opts.quality || OPENAI_IMAGE_QUALITY);
  field('output_format', 'png');
  field('n', '1');
  images.forEach((img, i) => {
    const ext = /jpe?g/.test(img.mimeType) ? 'jpg' : /webp/.test(img.mimeType) ? 'webp' : 'png';
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="image${i + 1}.${ext}"\r\nContent-Type: ${img.mimeType}\r\n\r\n`));
    chunks.push(Buffer.from(img.data, 'base64'));
    chunks.push(Buffer.from('\r\n'));
  });
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { body: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

// A Response-like answer, which is all aiDesign.web.js reads (ok, status, json()).
function answer(status, json) {
  return { ok: status >= 200 && status < 300, status, json: async () => json };
}

function errorAnswer(status, json) {
  const msg = json?.error?.message || `HTTP ${status}`;
  return answer(status >= 400 ? status : 502, { error: { message: `OpenAI: ${msg}` } });
}

async function post(path, key, body, contentType) {
  const resp = await globalThis.fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': contentType },
    body
  });
  const json = await resp.json().catch(() => ({}));
  return { status: resp.status, json };
}

/**
 * Sends a Gemini-shaped request to OpenAI and answers like Gemini.
 * kind: 'image' (the picture) or 'check' (any of the JSON checks).
 * A picture OpenAI's safety system refused comes back as "no image", which
 * aiDesign.web.js already handles (the design is blocked, and not counted).
 */
export async function callOpenAIAsGemini(kind, apiKey, body) {
  const key = String(apiKey).slice(KEY_PREFIX.length);
  if (kind === 'image') {
    const { prompt, images } = splitGeminiBody(body);
    const form = imageEditForm(prompt, images);
    const { status, json } = await post('/images/edits', key, form.body, form.contentType);
    if (status === 400 && /moderation|safety/i.test(`${json?.error?.code || ''} ${json?.error?.message || ''}`)) {
      console.warn('OpenAI declined to paint this picture (safety).');
      return answer(200, { candidates: [] });
    }
    if (status < 200 || status >= 300) return errorAnswer(status, json);
    const b64 = json?.data?.[0]?.b64_json;
    if (!b64) return answer(200, { candidates: [] });
    return answer(200, { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: b64 } }] } }] });
  }

  const { status, json } = await post('/responses', key, JSON.stringify(checkRequest(body)), 'application/json');
  if (status < 200 || status >= 300) return errorAnswer(status, json);
  const text = responseText(json);
  // A refusal or an empty answer is "the checker couldn't answer": every
  // check in aiDesign.web.js treats that as a refusal or an outage, never a pass.
  if (text === null) return errorAnswer(502, { error: { message: 'no answer from the check model' } });
  return answer(200, { candidates: [{ content: { parts: [{ text }] } }] });
}

// The Code panel tests are in backend/fetchDashOpenAITest.js.
