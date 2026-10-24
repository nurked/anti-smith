import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../src/index.js';

const meta = (id, kind, extra = {}) => ({
  id,
  kind,
  version: '0.1.0',
  title: id,
  description: `${id} test plugin`,
  ...(kind === 'detector' ? { weight: 'strong', limitations: ['test'] } : {}),
  ...extra,
});

const fakeWindow = () => ({ navigator: { userAgent: 'test' }, location: { href: 'http://localhost/' } });

test('detectors start pending and their reports drive the score', async () => {
  let ctxSeen;
  const detector = meta('detector.flag', 'detector', {
    start(ctx) {
      ctxSeen = ctx;
      ctx.report({ status: 'clean' });
    },
  });
  const runtime = createRuntime({ plugins: [detector], window: fakeWindow() });
  await runtime.start();
  assert.equal(runtime.findings()[0].status, 'clean');
  ctxSeen.report({ status: 'detected', evidence: { why: 'test' } });
  assert.equal(runtime.score().level, 'likely-agent');
  assert.deepEqual(runtime.findings()[0].evidence, { why: 'test' });
  runtime.stop();
});

test('escalate never lowers a status', async () => {
  let ctx;
  const runtime = createRuntime({
    plugins: [meta('detector.esc', 'detector', { start: (c) => void (ctx = c) })],
    window: fakeWindow(),
  });
  await runtime.start();
  ctx.escalate({ status: 'suspicious' });
  ctx.escalate({ status: 'clean' });
  assert.equal(ctx.finding().status, 'suspicious');
  ctx.escalate({ status: 'detected' });
  assert.equal(ctx.finding().status, 'detected');
  runtime.stop();
});

test('a throwing detector becomes an error finding instead of breaking the runtime', async () => {
  const broken = meta('detector.broken', 'detector', {
    start() {
      throw new Error('boom');
    },
  });
  const fine = meta('detector.fine', 'detector', { start: (ctx) => ctx.report({ status: 'clean' }) });
  const runtime = createRuntime({ plugins: [broken, fine], window: fakeWindow() });
  await runtime.start();
  const byId = Object.fromEntries(runtime.findings().map((f) => [f.id, f.status]));
  assert.deepEqual(byId, { 'detector.broken': 'error', 'detector.fine': 'clean' });
  assert.ok(runtime.log.all().some((e) => e.type === 'plugin.error' && e.data.plugin === 'detector.broken'));
});

test('sinks receive every event, responders receive every score', async () => {
  const events = [];
  const scores = [];
  const sink = meta('sink.collect', 'sink', { onEvent: (event) => events.push(event.type) });
  const responder = meta('responder.collect', 'responder', { onScore: (result) => scores.push(result.score) });
  const detector = meta('detector.hit', 'detector', { start: (ctx) => ctx.report({ status: 'detected' }) });
  const runtime = createRuntime({ plugins: [detector, responder, sink], window: fakeWindow() });
  await runtime.start();
  assert.ok(events.includes('runtime.start'));
  assert.ok(events.includes('finding'));
  assert.ok(events.includes('runtime.ready'));
  assert.equal(scores.at(-1), 40);
  runtime.stop();
  assert.ok(events.includes('runtime.stop'));
});

test('plugins can be disabled through config', async () => {
  const detector = meta('detector.off', 'detector', { start: (ctx) => ctx.report({ status: 'detected' }) });
  const runtime = createRuntime({
    plugins: [detector],
    window: fakeWindow(),
    config: { plugins: { 'detector.off': { enabled: false } } },
  });
  await runtime.start();
  assert.equal(runtime.findings().length, 0);
  assert.equal(runtime.plugins()[0].enabled, false);
});

test('config merges plugin defaults with per-plugin overrides', async () => {
  let seen;
  const detector = meta('detector.cfg', 'detector', { defaults: { a: 1, b: 2 }, start: (ctx) => void (seen = ctx.config) });
  const runtime = createRuntime({ plugins: [detector], window: fakeWindow(), config: { plugins: { 'detector.cfg': { b: 3 } } } });
  await runtime.start();
  assert.deepEqual({ ...seen }, { a: 1, b: 3 });
});

test('observeCall watches without changing behaviour and restores on stop', async () => {
  const target = { add: (a, b) => a + b };
  const original = target.add;
  const calls = [];
  const detector = meta('detector.watch', 'detector', {
    start(ctx) {
      ctx.observeCall(target, 'add', ({ args, result }) => {
        calls.push({ args, result });
        throw new Error('observer bugs must not leak into the page');
      });
      ctx.report({ status: 'clean' });
    },
  });
  const runtime = createRuntime({ plugins: [detector], window: fakeWindow() });
  await runtime.start();
  assert.equal(target.add(2, 3), 5);
  assert.deepEqual(calls, [{ args: [2, 3], result: 5 }]);
  runtime.stop();
  assert.equal(target.add, original);
});

test('observeGetter on an instance shadows the prototype getter and is removed on stop', async () => {
  class Thing {
    get secret() {
      return 'value';
    }
  }
  const thing = new Thing();
  let reads = 0;
  const detector = meta('detector.getter', 'detector', {
    start(ctx) {
      ctx.observeGetter(thing, 'secret', () => reads++);
    },
  });
  const runtime = createRuntime({ plugins: [detector], window: fakeWindow() });
  await runtime.start();
  assert.equal(thing.secret, 'value');
  assert.equal(reads, 1);
  assert.ok(Object.getOwnPropertyDescriptor(thing, 'secret'));
  runtime.stop();
  assert.equal(Object.getOwnPropertyDescriptor(thing, 'secret'), undefined);
  assert.equal(thing.secret, 'value');
});

test('exportJSON contains findings, plugin metadata and the log', async () => {
  const detector = meta('detector.exp', 'detector', { start: (ctx) => ctx.report({ status: 'suspicious' }) });
  const runtime = createRuntime({ plugins: [detector], window: fakeWindow() });
  await runtime.start();
  const out = runtime.exportJSON({ label: 'unit' });
  assert.equal(out.format, 'anti-smith.export/v1');
  assert.equal(out.meta.label, 'unit');
  assert.equal(out.findings[0].status, 'suspicious');
  assert.equal(out.plugins[0].id, 'detector.exp');
  assert.ok(out.log.events.length > 0);
});
