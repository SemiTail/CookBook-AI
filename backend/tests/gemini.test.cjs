const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ConfigService } = require('@nestjs/config');
const { GeminiService } = require('../dist/src/assistant/gemini.service.js');

test('Gemini adapter handles missing key, provider failures, blocked/empty output and response text safely', async t => {
  const service = new GeminiService(new ConfigService({ GEMINI_API_KEY: 'test-key', GEMINI_MODEL: 'gemini-3.5-flash' }));
  const contents = [{ role: 'user', parts: [{ text: 'Салат?' }] }];
  const noKey = new GeminiService(new ConfigService({ GEMINI_API_KEY: '' }));
  assert.equal(noKey.available, false);
  await assert.rejects(() => noKey.generate('system', contents), e => e.getStatus() === 503);
  for (const status of [429, 503, 403]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { message: 'secret provider detail' } }, { status }));
    await assert.rejects(() => service.generate('system', contents), e => e.getStatus() === (status === 403 ? 502 : status) && !e.message.includes('secret provider detail'));
    t.mock.restoreAll();
  }
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('network'); });
  await assert.rejects(() => service.generate('system', contents), e => e.getStatus() === 503);
  t.mock.restoreAll();
  for (const data of [{}, { candidates: [{ finishReason: 'SAFETY', content: { parts: [{ text: 'blocked' }] } }] }]) {
    t.mock.method(globalThis, 'fetch', async () => Response.json(data));
    await assert.rejects(() => service.generate('system', contents), e => e.getStatus() === 502);
    t.mock.restoreAll();
  }
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.ok(String(url).startsWith('https://generativelanguage.googleapis.com/'));
    assert.equal(options.headers['x-goog-api-key'], 'test-key');
    assert.deepEqual(JSON.parse(options.body).contents, contents);
    return Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'hidden', thought: true }, { text: 'Рецепт салату' }] } }] });
  });
  const reply = await service.generate('system', contents);
  assert.match(reply, /Рецепт салату/); assert.match(reply, /скорочено/); assert.doesNotMatch(reply, /hidden/);
});
