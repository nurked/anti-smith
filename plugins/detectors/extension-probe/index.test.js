import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPlugin, fakeWindow } from '../../../packages/testkit/src/index.js';
import plugin from './index.js';

const extension = { name: 'Agent', extensionId: 'a'.repeat(32), resourcePaths: ['old-build.js', 'new-build.js'] };
const withFetch = (loadable) =>
  fakeWindow({ fetch: async (url) => (loadable.some((path) => url.endsWith(path)) ? { ok: true } : Promise.reject(new TypeError('blocked'))) });

test('installed when any of the listed paths loads', async () => {
  const run = await runPlugin(plugin, { window: withFetch(['new-build.js']), config: { extensions: [extension] } });
  assert.equal(run.finding().status, 'detected');
  assert.deepEqual(run.finding().evidence.found, ['Agent']);
});

test('clean when every path is blocked', async () => {
  const run = await runPlugin(plugin, { window: withFetch([]), config: { extensions: [extension] } });
  assert.equal(run.finding().status, 'clean');
});

test('entries without an id or paths are reported as placeholders, not probed', async () => {
  const run = await runPlugin(plugin, { window: withFetch([]), config: { extensions: [{ name: 'Todo', extensionId: '' }] } });
  assert.deepEqual(run.finding().evidence.placeholders, ['Todo']);
});
