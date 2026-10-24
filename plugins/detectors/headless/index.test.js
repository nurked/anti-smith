import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPlugin, fakeWindow } from '../../../packages/testkit/src/index.js';
import plugin from './index.js';

const realChrome = () =>
  fakeWindow({
    navigator: {
      plugins: { length: 5 },
      userAgentData: { platform: 'macOS', brands: [{ brand: 'Google Chrome', version: '141' }] },
    },
    chrome: {},
    outerWidth: 1440,
    outerHeight: 900,
  });

test('HeadlessChrome in the UA is detected as strong', async () => {
  const window = realChrome();
  window.navigator.userAgent = window.navigator.userAgent.replace('Chrome/', 'HeadlessChrome/');
  const run = await runPlugin(plugin, { window });
  assert.equal(run.finding().status, 'detected');
  assert.equal(run.finding().weight, 'strong');
});

test('a consistent desktop Chrome is clean', async () => {
  const run = await runPlugin(plugin, { window: realChrome() });
  assert.equal(run.finding().status, 'clean', JSON.stringify(run.finding().evidence));
});

test('a client-hint platform no browser sends is a spoof and detected', async () => {
  const window = realChrome();
  window.navigator.userAgentData.platform = 'Mac OS X'; // what puppeteer-extra stealth sets
  const run = await runPlugin(plugin, { window });
  assert.equal(run.finding().status, 'detected');
  assert.equal(run.finding().evidence.spoofed.length, 1);
});

test('a client-hint platform mismatch is suspicious', async () => {
  const window = realChrome();
  window.navigator.userAgentData.platform = 'Linux';
  const run = await runPlugin(plugin, { window });
  assert.equal(run.finding().status, 'suspicious');
});
