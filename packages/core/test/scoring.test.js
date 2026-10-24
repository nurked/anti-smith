import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreFindings } from '../src/index.js';

const finding = (id, weight, status) => ({ id, title: id, weight, status });

test('clean and pending findings contribute nothing', () => {
  const result = scoreFindings([finding('a', 'strong', 'clean'), finding('b', 'strong', 'pending')]);
  assert.equal(result.score, 0);
  assert.equal(result.level, 'clean');
  assert.deepEqual(result.contributors, []);
});

test('suspicious counts half, detected counts full', () => {
  const result = scoreFindings([finding('a', 'medium', 'suspicious'), finding('b', 'medium', 'detected')]);
  assert.equal(result.score, Math.round(7.5 + 15));
  assert.equal(result.contributors[0].id, 'b');
});

test('one strong detection is enough for likely-agent', () => {
  assert.equal(scoreFindings([finding('a', 'strong', 'detected')]).level, 'likely-agent');
});

test('score is capped at 100 and thresholds are configurable', () => {
  const many = Array.from({ length: 5 }, (_, i) => finding(`d${i}`, 'strong', 'detected'));
  assert.equal(scoreFindings(many).score, 100);
  const result = scoreFindings([finding('a', 'weak', 'detected')], { thresholds: { suspicious: 5 } });
  assert.equal(result.level, 'suspicious');
});
