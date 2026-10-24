#!/usr/bin/env node
/**
 * Scaffolds a new plugin folder with index.js, index.test.js and README.md.
 *
 * Usage: npm run new-plugin -- <detector|responder|sink> <kebab-name>
 *   e.g. npm run new-plugin -- detector webgl-timing
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIND_FOLDERS } from './lib/discover-plugins.mjs';

const [kind, name] = process.argv.slice(2);
if (!KIND_FOLDERS[kind] || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name ?? '')) {
  console.error('Usage: npm run new-plugin -- <detector|responder|sink> <kebab-name>');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'plugins', KIND_FOLDERS[kind], name);
try {
  await access(dir);
  console.error(`${path.relative(root, dir)} already exists`);
  process.exit(1);
} catch {
  // does not exist yet — good
}

const id = `${kind}.${name}`;
const title = name.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

const bodies = {
  detector: `  weight: 'weak', // strong | medium | weak — start weak, raise it once test runs justify it
  phase: 'runtime', // static (runs once) | runtime (keeps watching)
  tags: [],
  limitations: ['TODO: what this misses and what it falsely flags.'],
  defaults: {},

  start(ctx) {
    // Read the environment through ctx.window / ctx.document, listen with ctx.on(),
    // keep state in ctx.state, and report a verdict:
    ctx.report({ status: 'clean', evidence: {} });
  },`,
  responder: `  tags: [],
  defaults: { threshold: 40 },

  onScore(result, ctx) {
    // result = { score, level, contributors }. Detect-only for now: log, do not block.
  },`,
  sink: `  tags: [],
  defaults: {},

  onEvent(event, ctx) {
    // event = { seq, t, at, source, type, data }
  },`,
};

const plugin = `/**
 * ${title}.
 *
 * TODO: what agent behaviour this looks for and why it works.
 */
export default {
  id: '${id}',
  kind: '${kind}',
  version: '0.1.0',
  title: '${title}',
  description: 'TODO: one sentence.',
${bodies[kind]}
};
`;

const test = `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runPlugin, fakeWindow } from '../../../packages/testkit/src/index.js';
import plugin from './index.js';

test('${id} starts without errors', async () => {
  const run = await runPlugin(plugin, { window: fakeWindow() });
  ${kind === 'detector' ? "assert.notEqual(run.finding().status, 'error');" : 'assert.ok(run.runtime);'}
  run.stop();
});
`;

const readme = `# ${id}

TODO: one paragraph on what this ${kind} does.

## Signal

- What it observes:
- Which agents it should catch:
- Which agents it cannot see:

## False positives

-

## Test results

| Run (docs/test-plan.md) | Result | Export file |
| --- | --- | --- |
| Human, plain Chrome | | |
`;

await mkdir(dir, { recursive: true });
await writeFile(path.join(dir, 'index.js'), plugin);
await writeFile(path.join(dir, 'index.test.js'), test);
await writeFile(path.join(dir, 'README.md'), readme);
console.log(`Created ${path.relative(root, dir)}/ (index.js, index.test.js, README.md)`);
console.log('The lab picks it up automatically on reload. Run `npm run verify` before opening a PR.');
