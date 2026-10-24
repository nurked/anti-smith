import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../../packages/core/src/index.js';
import { fakeWindow } from '../../../packages/testkit/src/index.js';
import plugin from './index.js';

const detector = (status) => ({
  id: 'detector.fixed',
  kind: 'detector',
  version: '0.1.0',
  title: 'Fixed',
  description: 'Reports what the test tells it to.',
  weight: 'strong',
  evidence: 'deterministic',
  limitations: ['test'],
  start: (ctx) => ctx.report({ status }),
});

test('posts once per level reached, never for clean', async () => {
  const posts = [];
  const window = fakeWindow({ fetch: async (url, init) => (posts.push({ url, body: JSON.parse(init.body) }), { status: 200 }) });
  const runtime = createRuntime({ plugins: [plugin, detector('detected')], window });
  await runtime.start();
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, '/api/flag');
  assert.equal(posts[0].body.level, 'likely-agent');
  assert.deepEqual(posts[0].body.contributors, ['detector.fixed']);
  assert.equal(posts[0].body.sessionId, runtime.sessionId);
});

test('a clean page sends nothing', async () => {
  const posts = [];
  const window = fakeWindow({ fetch: async (...args) => (posts.push(args), { status: 200 }) });
  const runtime = createRuntime({ plugins: [plugin, detector('clean')], window });
  await runtime.start();
  assert.equal(posts.length, 0);
});
