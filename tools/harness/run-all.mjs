#!/usr/bin/env node
/**
 * Runs the task with every automation tool and prints a detector × run matrix.
 * Exports land in exports/<date>/ (git-ignored). The lab server must be running.
 *
 *   cd tools/harness && npm install && npm run setup   # once
 *   npm run run                                         # all runs
 *   npm run run -- firefox                              # only runs whose name contains "firefox"
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTask, LAB_URL } from './task.mjs';
import { openPlaywright, openPuppeteer, openSelenium } from './adapters.mjs';

const RUNS = [
  { name: 'playwright-chromium-headless', open: () => openPlaywright({ engine: 'chromium', headless: true }) },
  { name: 'playwright-chromium-headed', open: () => openPlaywright({ engine: 'chromium', headless: false }) },
  { name: 'playwright-firefox-headless', open: () => openPlaywright({ engine: 'firefox', headless: true }) },
  { name: 'playwright-webkit-headless', open: () => openPlaywright({ engine: 'webkit', headless: true }) },
  { name: 'puppeteer-chrome-headless', open: () => openPuppeteer({ browser: 'chrome', headless: true }) },
  { name: 'puppeteer-stealth-chrome-headless', open: () => openPuppeteer({ browser: 'chrome', headless: true, stealth: true }) },
  { name: 'puppeteer-firefox-bidi-headless', open: () => openPuppeteer({ browser: 'firefox', headless: true }) },
  { name: 'selenium-chrome-headless', open: () => openSelenium({ browser: 'chrome', headless: true }) },
  { name: 'selenium-firefox-headed', open: () => openSelenium({ browser: 'firefox', headless: false }) },
];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'exports', new Date().toISOString().slice(0, 10));
const filter = process.argv[2];
const selected = RUNS.filter((run) => !filter || run.name.includes(filter));

const check = await fetch(LAB_URL).catch(() => null);
if (!check?.ok) {
  console.error(`Lab not reachable at ${LAB_URL} — start it with \`npm start\` in the repo root.`);
  process.exit(1);
}
await mkdir(outDir, { recursive: true });

const outcomes = [];
for (const run of selected) {
  process.stdout.write(`▶ ${run.name} … `);
  let session;
  try {
    session = await run.open();
    const { scrapedCells, result } = await runTask(session.adapter, run.name);
    await writeFile(path.join(outDir, `${run.name}.json`), JSON.stringify(result, null, 2));
    outcomes.push({ run: run.name, result, scrapedCells });
    console.log(`score ${result.score.score} (${result.score.level})`);
  } catch (error) {
    outcomes.push({ run: run.name, error: String(error.message ?? error).split('\n')[0] });
    console.log(`FAILED: ${String(error.message ?? error).split('\n')[0]}`);
  } finally {
    await session?.close().catch(() => {});
  }
}

// Matrix: one row per detector, one column per run. D = detected, s = suspicious, · = clean, – = unsupported/pending, ! = error.
const mark = { detected: 'D', suspicious: 's', clean: '·', unsupported: '–', pending: '–', error: '!' };
const ok = outcomes.filter((o) => o.result);
const detectorIds = [...new Set(ok.flatMap((o) => o.result.findings.map((f) => f.id)))].sort();
const lines = [
  `| Detector | ${ok.map((o) => o.run).join(' | ')} |`,
  `| --- | ${ok.map(() => ':-:').join(' | ')} |`,
  ...detectorIds.map((id) => {
    const cells = ok.map((o) => mark[o.result.findings.find((f) => f.id === id)?.status] ?? '');
    return `| ${id.replace('detector.', '')} | ${cells.join(' | ')} |`;
  }),
  `| **score** | ${ok.map((o) => `**${o.result.score.score}**`).join(' | ')} |`,
];
for (const failed of outcomes.filter((o) => o.error)) lines.push('', `${failed.run}: failed — ${failed.error}`);
const matrix = lines.join('\n');
await writeFile(path.join(outDir, 'matrix.md'), `${matrix}\n\nD detected · s suspicious · · clean · – unsupported\n`);
console.log(`\n${matrix}\n\nD detected · s suspicious · · clean · – unsupported\nExports: ${path.relative(root, outDir)}/`);
