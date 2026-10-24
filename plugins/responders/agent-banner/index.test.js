import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRuntime } from '../../../packages/core/src/index.js';
import { fakeWindow } from '../../../packages/testkit/src/index.js';
import plugin from './index.js';

// Just enough DOM for the banner: elements with attributes, text and children.
class FakeElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.nodeType = 1;
    this.attributes = new Map();
    this.children = [];
    this.parent = null;
    this.textContent = '';
  }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  append(...nodes) {
    for (const node of nodes) (node.parent = this), this.children.push(node);
  }
  prepend(node) {
    node.parent = this;
    this.children.unshift(node);
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
}

// Stands in for a protection responder whose step-up succeeded: the test logs human-verified through its ctx.
const verifier = {
  id: 'responder.fake-verifier',
  kind: 'responder',
  version: '0.1.0',
  title: 'Fake verifier',
  description: 'Stands in for a protection responder whose step-up succeeded.',
  onScore() {},
};

async function setup() {
  const document = { documentElement: new FakeElement('html'), body: new FakeElement('body'), createElement: (t) => new FakeElement(t) };
  let verifierCtx;
  const runtime = createRuntime({
    plugins: [plugin, { ...verifier, start: (ctx) => void (verifierCtx = ctx) }],
    window: fakeWindow({ document }),
    document,
    config: { plugins: { 'responder.agent-banner': { enabled: true } } },
  });
  await runtime.start();
  const banner = () => document.body.children.find((el) => el.getAttribute('data-as-banner') !== null) ?? null;
  return { runtime, banner, verifierCtx };
}

test('a manual trigger shows the banner whatever the score and level', async () => {
  const { runtime, banner } = await setup();
  assert.equal(banner(), null);
  runtime.emit('protection-trigger', { responder: 'responder.agent-banner' });
  assert.ok(banner());
  assert.equal(banner().children[1].textContent, '(triggered manually)');
});

test('a trigger for another responder leaves the banner alone; a trigger for all shows it', async () => {
  const { runtime, banner } = await setup();
  runtime.emit('protection-trigger', { responder: 'responder.lockout' });
  assert.equal(banner(), null);
  runtime.emit('protection-trigger', { responder: null });
  assert.ok(banner());
});

test('a host cannot unlock: human-verified only counts when a responder sends it', async () => {
  const { runtime, banner, verifierCtx } = await setup();
  runtime.emit('protection-trigger', { responder: null });
  runtime.emit('human-verified', { by: 'page script' });
  assert.ok(banner(), 'host-sent human-verified must be ignored');
  verifierCtx.log('human-verified', { by: 'step-up' });
  assert.equal(banner(), null);
});
