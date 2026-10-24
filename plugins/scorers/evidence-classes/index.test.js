import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../../packages/core/src/index.js';
import { fakeWindow } from '../../../packages/testkit/src/index.js';
import plugin from './index.js';

const detector = (name, evidence, status, weight = 'medium') => ({
  id: `detector.${name}`,
  kind: 'detector',
  version: '0.1.0',
  title: name,
  description: 'test detector',
  weight,
  evidence,
  limitations: ['test'],
  start: (ctx) => ctx.report({ status }),
});

const run = async (...detectors) => {
  const runtime = createRuntime({ plugins: [plugin, ...detectors], window: fakeWindow() });
  await runtime.start();
  return runtime.score();
};

test('behaviour-only evidence is marked as such and is not deterministic', async () => {
  const result = await run(detector('mouse', 'behaviour', 'detected'), detector('keys', 'behaviour', 'suspicious'));
  assert.equal(result.score, 23);
  assert.equal(result.behaviourOnly, true);
  assert.equal(result.deterministic, false);
  assert.deepEqual(result.classes.behaviour, ['detector.mouse', 'detector.keys']);
});

test('a detected deterministic signal sets deterministic', async () => {
  const result = await run(detector('webdriver', 'deterministic', 'detected', 'strong'), detector('mouse', 'behaviour', 'detected'));
  assert.equal(result.deterministic, true);
  assert.equal(result.behaviourOnly, false);
  assert.equal(result.level, 'likely-agent');
});

test('a merely suspicious deterministic detector does not set deterministic', async () => {
  const result = await run(detector('webdriver', 'deterministic', 'suspicious', 'strong'));
  assert.equal(result.deterministic, false);
});

test('the runtime falls back to the built-in scorer if a scorer plugin throws', async () => {
  const broken = { ...plugin, id: 'scorer.broken', score() { throw new Error('boom'); } };
  const runtime = createRuntime({ plugins: [broken, detector('mouse', 'behaviour', 'detected')], window: fakeWindow() });
  await runtime.start();
  assert.equal(runtime.score().score, 15);
  assert.equal(runtime.score().deterministic, undefined);
  assert.ok(runtime.log.all().some((e) => e.type === 'plugin.error' && e.data.plugin === 'scorer.broken'));
});
