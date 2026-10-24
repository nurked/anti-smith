#!/usr/bin/env node
/**
 * Writes a starter README.md for every plugin that does not have one yet, from
 * the plugin's metadata and its top doc comment. Existing READMEs are never
 * touched — they belong to their authors once written.
 *
 * Usage: node tools/gen-readmes.mjs
 */
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { discoverPlugins } from './lib/discover-plugins.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RUNS = ['Human, plain Chrome', 'Human, DevTools open', 'Playwright default', 'Playwright + stealth', 'Puppeteer', 'Claude for Chrome'];

for (const info of await discoverPlugins(root)) {
  const target = path.join(info.dir, 'README.md');
  try {
    await access(target);
    continue;
  } catch {
    // no README yet
  }
  const plugin = (await import(pathToFileURL(info.entry).href)).default;
  const source = await readFile(info.entry, 'utf8');
  const comment = (source.match(/^\/\*\*([\s\S]*?)\*\//m)?.[1] ?? '')
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, ''))
    .join('\n')
    .trim();
  const defaults = plugin.defaults && Object.keys(plugin.defaults).length
    ? '```json\n' + JSON.stringify(plugin.defaults, (key, value) => (typeof value === 'function' ? '<function>' : value), 2) + '\n```'
    : '_None._';
  const parts = [`# ${plugin.title} — \`${plugin.id}\``, plugin.description];
  if (plugin.kind === 'detector') parts.push(`**Weight:** ${plugin.weight} · **Evidence:** ${plugin.evidence} · **Phase:** ${plugin.phase}${plugin.noisy ? ' · **Noisy**' : ''}`);
  parts.push('## How it works', comment || '_TODO._');
  parts.push('## Configuration', `Override in the host config under \`plugins['${plugin.id}']\`. Defaults:`, defaults);
  if (plugin.limitations?.length) parts.push('## Limitations', plugin.limitations.map((l) => `- ${l}`).join('\n'));
  if (plugin.kind === 'detector') {
    parts.push(
      '## Test results',
      'Fill in from the runs in [docs/test-plan.md](../../../docs/test-plan.md).',
      ['| Run | Result | Export file |', '| --- | --- | --- |', ...RUNS.map((run) => `| ${run} | | |`)].join('\n'),
    );
  }
  await writeFile(target, parts.join('\n\n') + '\n');
  console.log(`wrote ${path.relative(root, target)}`);
}
