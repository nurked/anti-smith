import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPlugin, fakeWindow } from '../../../packages/testkit/src/index.js';
import plugin from './index.js';

// Node has EventTarget and Event built in; event.timeStamp is real time, so dispatching
// back to back gives a gap of well under a millisecond.
const setup = async () => {
  const document = new EventTarget();
  const window = Object.assign(new EventTarget(), fakeWindow(), { document });
  const run = await runPlugin(plugin, { window, document });
  return { window, document, run };
};

test('an unexplained scroll followed straight away by a click is suspicious', async () => {
  const { document, run } = await setup();
  document.dispatchEvent(new Event('scroll'));
  document.dispatchEvent(new Event('click'));
  assert.equal(run.finding().status, 'suspicious');
  run.stop();
});

test('a wheel scroll followed by a click is clean', async () => {
  const { window, document, run } = await setup();
  window.dispatchEvent(new Event('wheel'));
  document.dispatchEvent(new Event('scroll'));
  document.dispatchEvent(new Event('click'));
  assert.equal(run.finding().status, 'clean');
  run.stop();
});

test('three scroll-then-click pairs are detected', async () => {
  const { document, run } = await setup();
  for (let i = 0; i < 3; i++) {
    document.dispatchEvent(new Event('scroll'));
    document.dispatchEvent(new Event('click'));
  }
  assert.equal(run.finding().status, 'detected');
  run.stop();
});
