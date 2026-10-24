import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createAntiSmithHandler, createCanaryScanner, classifyRequest, createSessionStore } from '../src/index.js';

async function withServer(fn) {
  const records = [];
  const antiSmith = createAntiSmithHandler({
    onRecord: (record) => records.push(record),
    lists: { 'agent-user-agents': { data: [{ pattern: 'ChatGPT-User', name: 'ChatGPT user fetch', kind: 'agent' }] } },
  });
  const server = http.createServer(async (req, res) => {
    if (await antiSmith.handle(req, res)) return;
    await antiSmith.inspect(req);
    res.end('ok');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn({ base, records, store: antiSmith.store });
  } finally {
    server.close();
  }
}

const post = (url, body) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('client logs build a session; a replayed canary flags it', async () => {
  await withServer(async ({ base, records, store }) => {
    const events = [{ seq: 1, type: 'canary', source: 'detector.honeypots', data: { token: 'AS-CANARY-ABCDEF1234' } }];
    assert.equal((await post(`${base}/log`, { sessionId: 's1', events })).status, 204);
    assert.deepEqual(store.get('s1').canaryTokens, ['AS-CANARY-ABCDEF1234']);
    assert.ok(records.some((r) => r.kind === 'event' && r.sessionId === 's1'));

    // Later, something fetches a URL carrying that token: the page content was harvested.
    await fetch(`${base}/anything?ref=as-canary-abcdef1234`);
    const hit = records.find((r) => r.kind === 'canary-hit');
    assert.equal(hit.plantedBySession, 's1');
    assert.equal(store.get('s1').flags[0].reason, 'canary-replayed');
  });
});

test('the flag route records responder.notify-server reports', async () => {
  await withServer(async ({ base, store }) => {
    const res = await post(`${base}/api/flag`, { sessionId: 's2', reason: 'score-threshold', score: 63, contributors: ['detector.mouse-dynamics'] });
    assert.equal(res.status, 200);
    assert.equal(store.get('s2').flags[0].score, 63);
    assert.equal((await post(`${base}/api/flag`, {})).status, 400);
  });
});

test('trap routes answer 204 and record the hit', async () => {
  await withServer(async ({ base, records }) => {
    const res = await fetch(`${base}/__as_trap/offscreen-link`, { headers: { 'user-agent': 'Mozilla/5.0 ChatGPT-User/1.0' } });
    assert.equal(res.status, 204);
    const hit = records.find((r) => r.kind === 'trap-hit');
    assert.ok(hit.serverFlags.some((f) => f.flag === 'agent-user-agent' && f.name === 'ChatGPT user fetch'));
  });
});

test('classifyRequest flags Chromium user agents without Fetch Metadata', () => {
  const signals = { userAgent: 'Mozilla/5.0 Chrome/156.0.0.0', acceptLanguage: 'en', clientHints: {}, fetchMetadata: {} };
  const flags = classifyRequest(signals).map((f) => f.flag);
  assert.deepEqual(flags, ['chromium-ua-without-fetch-metadata', 'chromium-ua-without-client-hints']);
});

test('canary scanner walks nested values and dedupes', () => {
  const scanner = createCanaryScanner();
  assert.deepEqual(scanner.scanValue({ a: ['x AS-CANARY-ABC123 y', { b: 'as-canary-abc123' }] }), ['AS-CANARY-ABC123']);
});

test('session store evicts beyond capacity, oldest first', () => {
  const store = createSessionStore({ maxSessions: 2 });
  store.update('a');
  store.update('b');
  store.update('c');
  assert.deepEqual(store.list().map((s) => s.id), ['b', 'c']);
});
