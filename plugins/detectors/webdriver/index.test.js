import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPlugin, fakeWindow } from '../../../packages/testkit/src/index.js';
import plugin from './index.js';

test('webdriver === true is detected', async () => {
  const run = await runPlugin(plugin, { window: fakeWindow({ navigator: { webdriver: true } }) });
  assert.equal(run.finding().status, 'detected');
});

test('a normal Chrome navigator is clean', async () => {
  const run = await runPlugin(plugin, { window: fakeWindow() });
  assert.equal(run.finding().status, 'clean');
});

test('Chrome with the property deleted is suspicious', async () => {
  const window = fakeWindow();
  delete window.navigator.webdriver;
  const run = await runPlugin(plugin, { window });
  assert.equal(run.finding().status, 'suspicious');
});
