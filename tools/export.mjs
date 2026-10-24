#!/usr/bin/env node
/**
 * Exports what a website needs to serve anti-smith in the browser:
 *
 *   <dest>/packages/core/src/…      runtime
 *   <dest>/packages/embed/src/…     startAntiSmith(), auto.js, integrations
 *   <dest>/plugins/<kind>/<name>/index.js
 *   <dest>/lists.json               all signal lists in one file
 *   <dest>/anti-smith.json          starter config (only written if missing)
 *
 * Usage: node tools/export.mjs <dest-dir> [--base /anti-smith]
 *   --base is the URL path the folder will be served at (default /anti-smith).
 *   It is written into anti-smith.json so plugin and list URLs resolve.
 */
import { cp, mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverPlugins } from './lib/discover-plugins.mjs';
import { loadLists } from './lib/load-lists.mjs';

const args = process.argv.slice(2);
const dest = args.find((a) => !a.startsWith('--'));
const baseIndex = args.indexOf('--base');
const base = (baseIndex >= 0 ? args[baseIndex + 1] : '/anti-smith').replace(/\/$/, '');
if (!dest || !base.startsWith('/')) {
  console.error('Usage: node tools/export.mjs <dest-dir> [--base /anti-smith]');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(dest);

// Plugins the starter config enables. Noisy ones (cdp-console, debugger-timing, capture-hints) are left out.
const STARTER = [
  'scorer.evidence-classes',
  'detector.webdriver',
  'detector.automation-globals',
  'detector.headless',
  'detector.permissions-consistency',
  'detector.native-patches',
  'detector.dom-mutations',
  'detector.input-trust',
  'detector.mouse-dynamics',
  'detector.keyboard-dynamics',
  'detector.focus-scroll',
  'detector.interaction-timing',
  'detector.scroll-then-click',
  'detector.sensitive-reads',
  'detector.extension-probe',
  'detector.honeypots',
  'sink.http-log',
  'responder.notify-server',
  'responder.step-up',
  'responder.agent-banner',
  'responder.lockout',
  'responder.agent-notice',
];

for (const pkg of ['core', 'embed']) {
  await cp(path.join(root, 'packages', pkg, 'src'), path.join(out, 'packages', pkg, 'src'), { recursive: true });
}
const plugins = await discoverPlugins(root);
for (const plugin of plugins) {
  const target = path.join(out, path.relative(root, plugin.entry));
  await mkdir(path.dirname(target), { recursive: true });
  await cp(plugin.entry, target);
}
const lists = await loadLists(root);
for (const list of Object.values(lists)) delete list.file;
await writeFile(path.join(out, 'lists.json'), `${JSON.stringify(lists, null, 2)}\n`);

const configFile = path.join(out, 'anti-smith.json');
let wroteConfig = false;
try {
  await access(configFile);
} catch {
  const byId = new Map(plugins.map((p) => [p.id, p]));
  const config = {
    plugins: STARTER.filter((id) => byId.has(id)).map((id) => `${base}${byId.get(id).urlPath}`),
    lists: `${base}/lists.json`,
    config: {
      plugins: {
        'sink.http-log': { endpoint: '/log' },
        'responder.notify-server': { endpoint: '/api/flag' },
        'responder.step-up': { enabled: true, basePath: '/api/step-up/' },
        'responder.agent-banner': { enabled: true, threshold: 40 },
        'responder.lockout': { enabled: true, threshold: 40 },
        'responder.agent-notice': { enabled: true, threshold: 40 },
      },
    },
  };
  await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`);
  wroteConfig = true;
}

console.log(`Exported ${plugins.length} plugins and ${Object.keys(lists).length} lists to ${out}`);
console.log(wroteConfig ? `Wrote starter config ${configFile} (base ${base})` : `Kept existing ${configFile}`);
console.log(`Serve ${out} at ${base}/ and load ${base}/packages/embed/src/auto.js — see docs/getting-started.md`);
