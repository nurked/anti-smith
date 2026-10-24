import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPlugin, fakeWindow } from '../../../packages/testkit/src/index.js';
import plugin from './index.js';

const withPermissions = (permission, state) =>
  fakeWindow({
    Notification: { permission },
    navigator: { permissions: { query: async () => ({ state }) } },
  });

test('denied vs prompt (old headless) is detected', async () => {
  const run = await runPlugin(plugin, { window: withPermissions('denied', 'prompt') });
  assert.equal(run.finding().status, 'detected');
});

test('default vs prompt is clean', async () => {
  const run = await runPlugin(plugin, { window: withPermissions('default', 'prompt') });
  assert.equal(run.finding().status, 'clean');
});

test('missing APIs are unsupported, not clean', async () => {
  const run = await runPlugin(plugin, { window: fakeWindow() });
  assert.equal(run.finding().status, 'unsupported');
});
