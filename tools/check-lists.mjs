#!/usr/bin/env node
/**
 * Validates lists/*.json and every plugin's `lists` references.
 *  - each file: name matches the file name, version is YYYY.MM.DD, description, data present
 *  - each plugin list path resolves to a value of the same type as the plugin's default
 *
 * Usage: npm run check (runs together with check-plugins)
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadLists } from './lib/load-lists.mjs';
import { discoverPlugins } from './lib/discover-plugins.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const fail = (where, message) => {
  failures++;
  console.log(`✗ ${where}: ${message}`);
};

let lists;
try {
  lists = await loadLists(root);
} catch (error) {
  fail('lists/', `cannot parse: ${error.message}`);
  process.exit(1);
}

for (const [name, list] of Object.entries(lists)) {
  const where = `lists/${list.file}`;
  if (list.file !== `${name}.json`) fail(where, `name "${name}" does not match the file name`);
  if (!/^\d{4}\.\d{2}\.\d{2}$/.test(list.version ?? '')) fail(where, 'version must be a date like 2026.10.24');
  if (typeof list.description !== 'string' || !list.description.trim()) fail(where, 'description is required');
  if (list.data === undefined) fail(where, 'data is required');
}

for (const info of await discoverPlugins(root)) {
  const plugin = (await import(pathToFileURL(info.entry).href)).default;
  for (const [key, listPath] of Object.entries(plugin.lists ?? {})) {
    const [name, ...keys] = listPath.split('.');
    const value = keys.reduce((v, k) => (v == null ? undefined : v[k]), lists[name]?.data);
    const where = `${info.id} lists.${key}`;
    if (value === undefined) fail(where, `"${listPath}" does not resolve`);
    else if (Array.isArray(value) !== Array.isArray(plugin.defaults?.[key])) fail(where, `"${listPath}" type differs from defaults.${key}`);
  }
}

console.log(failures ? `\n${failures} list problem(s)` : `${Object.keys(lists).length} lists OK`);
process.exitCode = failures ? 1 : 0;
