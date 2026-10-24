import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePlugin, createRegistry } from '../src/index.js';

const detector = () => ({
  id: 'detector.example',
  kind: 'detector',
  version: '0.1.0',
  title: 'Example',
  description: 'Example detector.',
  weight: 'weak',
  limitations: ['Example only.'],
  start() {},
});

test('a complete detector has no problems', () => {
  assert.deepEqual(validatePlugin(detector()), []);
});

test('id must carry the kind prefix', () => {
  const problems = validatePlugin({ ...detector(), id: 'responder.example' });
  assert.ok(problems.some((p) => p.includes('must start with "detector."')));
});

test('detectors must declare weight and limitations', () => {
  const problems = validatePlugin({ ...detector(), weight: 'huge', limitations: [] });
  assert.equal(problems.length, 2);
});

test('responders need onScore, sinks need onEvent', () => {
  const base = { version: '0.1.0', title: 't', description: 'd' };
  assert.ok(validatePlugin({ ...base, id: 'responder.x', kind: 'responder' }).some((p) => p.includes('onScore')));
  assert.ok(validatePlugin({ ...base, id: 'sink.x', kind: 'sink' }).some((p) => p.includes('onEvent')));
});

test('registry rejects invalid and duplicate plugins', () => {
  const registry = createRegistry();
  registry.register(detector());
  assert.throws(() => registry.register(detector()), /Duplicate/);
  assert.throws(() => registry.register({ id: 'nope' }), /Invalid plugin/);
  assert.equal(registry.list('detector').length, 1);
});
