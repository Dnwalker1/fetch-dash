// Run with: npm run test:wix
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import { ageDecision } from 'backend/fetchDashAge';
import {
  OPENAI_IMAGE_MODEL, callOpenAIAsGemini, checkRequest, designKeyFor, isOpenAIKey, splitGeminiBody
} from 'backend/fetchDashOpenAI';
import { secrets } from 'wix-secrets-backend';

test('age: the first band counts, and only 18+ makes portraits', () => {
  assert.deepEqual(ageDecision(undefined, '18+'), { band: '18+', save: true, code: null });
  assert.deepEqual(ageDecision('18+', undefined), { band: '18+', save: false, code: null });
  assert.equal(ageDecision(undefined, undefined).code, 'age_needed');
  assert.equal(ageDecision(undefined, 'nonsense').code, 'age_needed');
  assert.equal(ageDecision(undefined, '13-17').code, 'minor_portraits_paused');
  assert.equal(ageDecision(undefined, 'under13').code, 'age_blocked');
  const changed = ageDecision('13-17', '18+');
  assert.equal(changed.code, 'minor_portraits_paused', 'answering again cannot change the band');
  assert.equal(changed.save, false);
});

// ---------------------------------------------------------------------------

const realFetch = globalThis.fetch;
let sent;
function fakeFetch(reply) {
  sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url, init });
    const [status, json] = reply(url, init);
    return { status, ok: status < 300, json: async () => json };
  };
}
beforeEach(() => {
  secrets.clear();
  secrets.set('OPENAI_API_KEY', ' sk-test ');
  secrets.set('GEMINI_API_KEY', 'gem-key');
});
afterEach(() => { globalThis.fetch = realFetch; });

const png = (s) => Buffer.from(s).toString('base64');
const geminiImageBody = {
  contents: [{ parts: [
    { text: 'The next 1 image is EXISTING ARTWORK.' },
    { inlineData: { mimeType: 'image/png', data: png('style') } },
    { text: "That is the end. The image that follows is the CUSTOMER'S PHOTOGRAPH." },
    { inlineData: { mimeType: 'image/jpeg', data: png('pet') } },
    { text: 'Paint CHEWY as the hero.' }
  ] }],
  generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '1:1', imageSize: '4K' } }
};

test('only game designs get the OpenAI key', async () => {
  assert.ok(isOpenAIKey(await designKeyFor('game_abc')));
  assert.equal(await designKeyFor('game_abc'), 'openai:sk-test');
  assert.equal(await designKeyFor('visitor-1'), 'gem-key', 'the website stays on Gemini');
  assert.equal(await designKeyFor('app_device'), 'gem-key', 'the app stays on Gemini');
  secrets.delete('OPENAI_API_KEY');
  await assert.rejects(designKeyFor('game_abc'), /OPENAI_API_KEY/);
});

test('the prompt keeps the images in order', () => {
  const { prompt, images } = splitGeminiBody(geminiImageBody);
  assert.equal(images.length, 2);
  assert.equal(images[1].mimeType, 'image/jpeg');
  assert.ok(prompt.indexOf('[Image 1]') < prompt.indexOf('[Image 2]'));
  assert.ok(prompt.indexOf('EXISTING ARTWORK') < prompt.indexOf('[Image 1]'));
  assert.ok(prompt.endsWith('Paint CHEWY as the hero.'));
});

test('the picture: pinned model, 1024, answered like Gemini', async () => {
  fakeFetch(() => [200, { data: [{ b64_json: png('art') }] }]);
  const r = await callOpenAIAsGemini('image', 'openai:sk-test', geminiImageBody);
  const json = await r.json();
  assert.ok(r.ok);
  assert.equal(json.candidates[0].content.parts[0].inlineData.data, png('art'));
  const { url, init } = sent[0];
  assert.equal(url, 'https://api.openai.com/v1/images/edits');
  assert.equal(init.headers.Authorization, 'Bearer sk-test');
  assert.match(init.headers['Content-Type'], /^multipart\/form-data; boundary=/);
  const form = init.body.toString('latin1');
  assert.ok(form.includes(`name="model"\r\n\r\n${OPENAI_IMAGE_MODEL}\r\n`), 'model pinned');
  assert.ok(form.includes('name="size"\r\n\r\n1024x1024\r\n'));
  assert.equal((form.match(/name="image\[\]"/g) || []).length, 2);
  assert.ok(!/game_|visitor/i.test(form), 'nothing that identifies the player');
});

test('a picture OpenAI refuses is "no image"; other errors are errors', async () => {
  fakeFetch(() => [400, { error: { code: 'moderation_blocked', message: 'Your request was rejected by the safety system.' } }]);
  let r = await callOpenAIAsGemini('image', 'openai:sk-test', geminiImageBody);
  assert.ok(r.ok);
  assert.deepEqual((await r.json()).candidates, []);
  fakeFetch(() => [429, { error: { message: 'Rate limit' } }]);
  r = await callOpenAIAsGemini('image', 'openai:sk-test', geminiImageBody);
  assert.equal(r.ok, false);
  assert.match((await r.json()).error.message, /OpenAI: Rate limit/);
});

test('the checks: JSON, store false, answered like Gemini, refusals fail closed', async () => {
  const body = { contents: [{ parts: [{ text: 'Count the animals. Reply as JSON.' }, { inlineData: { mimeType: 'image/jpeg', data: png('pet') } }] }], generationConfig: { responseMimeType: 'application/json' } };
  const req = checkRequest(body);
  assert.equal(req.store, false);
  assert.equal(req.text.format.type, 'json_object');
  assert.equal(req.input[0].content.filter(c => c.type === 'input_image').length, 1);
  assert.match(req.input[0].content.find(c => c.type === 'input_image').image_url, /^data:image\/jpeg;base64,/);

  fakeFetch(() => [200, { output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"animals":1,"harm":false}' }] }] }]);
  let r = await callOpenAIAsGemini('check', 'openai:sk-test', body);
  assert.equal((await r.json()).candidates[0].content.parts[0].text, '{"animals":1,"harm":false}');
  assert.equal(sent[0].url, 'https://api.openai.com/v1/responses');

  fakeFetch(() => [200, { output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }]);
  r = await callOpenAIAsGemini('check', 'openai:sk-test', body);
  assert.equal(r.ok, false, 'a refusal is never a pass');
});
