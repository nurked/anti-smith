import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPlugin, fakeWindow } from '../../../packages/testkit/src/index.js';
import plugin from './index.js';

// Real KeyboardEvent is not in Node; a plain Event with the fields the plugin reads is enough.
const key = (k) => Object.assign(new Event('keydown'), { key: k, repeat: false, isComposing: false });

test('typing faster than any person is suspicious', async () => {
  const document = new EventTarget();
  const run = await runPlugin(plugin, { window: Object.assign(new EventTarget(), fakeWindow(), { document }), document });
  // Dispatched back to back: gaps are well under a millisecond, like Claude in Chrome's 6 ms.
  for (const k of 'abcdefghijklmnop') document.dispatchEvent(key(k));
  assert.equal(run.finding().status, 'suspicious');
  assert.equal(run.finding().evidence.superhumanSpeed, true);
  run.stop();
});
