import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPlugin, fakeWindow } from '../../../packages/testkit/src/index.js';
import plugin from './index.js';

const config = { pollForMs: 0 };

test('Playwright binding is detected', async () => {
  const run = await runPlugin(plugin, { window: fakeWindow({ __playwright__binding__: () => {} }), config });
  assert.equal(run.finding().status, 'detected');
  assert.deepEqual(run.finding().evidence.markers, ['window.__playwright__binding__']);
});

test('ChromeDriver cdc_ prefix is detected', async () => {
  const run = await runPlugin(plugin, { window: fakeWindow({ cdc_adoQpoasnfa76pfcZLmcfl_Array: [] }), config });
  assert.equal(run.finding().status, 'detected');
});

test('a plain window is clean', async () => {
  const run = await runPlugin(plugin, { window: fakeWindow(), config });
  assert.equal(run.finding().status, 'clean');
});
