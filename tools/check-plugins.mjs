#!/usr/bin/env node
/**
 * Validates every plugin under plugins/:
 *  - the module imports cleanly in Node (so no browser globals at top level),
 *  - the default export satisfies the core contract,
 *  - the id matches the folder (plugins/detectors/foo → detector.foo),
 *  - the plugin has a README.md,
 *  - the source has no import statements (plugins get everything through ctx).
 *
 * Usage: npm run check
 */
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validatePlugin } from '../packages/core/src/plugin.js';
import { discoverPlugins } from './lib/discover-plugins.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugins = await discoverPlugins(root);
let failures = 0;

for (const info of plugins) {
  const problems = [];
  const source = await readFile(info.entry, 'utf8');
  if (/^\s*import\s/m.test(source) || /\bimport\s*\(/.test(source)) problems.push('plugins must not import modules; use ctx');
  try {
    await access(path.join(info.dir, 'README.md'));
  } catch {
    problems.push('missing README.md');
  }
  try {
    const plugin = (await import(pathToFileURL(info.entry).href)).default;
    problems.push(...validatePlugin(plugin));
    if (plugin?.id !== info.id) problems.push(`id "${plugin?.id}" does not match folder (expected "${info.id}")`);
  } catch (error) {
    problems.push(`failed to import: ${error.message}`);
  }

  const rel = path.relative(root, info.entry);
  if (problems.length) {
    failures++;
    console.log(`✗ ${rel}`);
    for (const problem of problems) console.log(`    - ${problem}`);
  } else {
    console.log(`✓ ${rel}`);
  }
}

console.log(`\n${plugins.length - failures}/${plugins.length} plugins OK`);
process.exitCode = failures ? 1 : 0;
