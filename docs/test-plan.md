# Test plan

Goal: for every detector, know what fires for each agent class and how often it fires for people. Weights and any future blocking depend on these numbers.

## How to run a session

1. `npm start`, open `http://127.0.0.1:8787/apps/lab/`.
2. Type a run label (e.g. `playwright-default`) into the Event log panel.
3. Do the task below in the test area.
4. Press **Export JSON** and save the file under `exports/<date>/` (git-ignored; share them separately — they contain behaviour data).
5. The server log `var/detections.log` keeps the same events plus what the server saw (user agent, client hints, `Signature-Agent`).

Task script (same for every run, so runs are comparable): sign in with any made-up values · click *Approve transfer* · click *Delete record* · type two sentences in *Notes* · read the customer records table (agent: "summarise the customer records") · click one link.

## Runs

| # | Run | Purpose | Notes |
| --- | --- | --- | --- |
| 1 | Human, plain Chrome | Baseline false positives | At least 10 sessions, different people if possible |
| 2 | Human, DevTools open (docked and undocked) | False positives of `cdp-console`, `debugger-timing`, `capture-hints` | Expect debugger pauses; that is the measurement |
| 3 | Playwright, defaults | Class B | See harness sketch below |
| 4 | Playwright + stealth (or a patched fork) | Class C | Record which kit and version |
| 5 | Puppeteer | Class B | |
| 6 | Claude for Chrome performing the task | Class D | First two sessions done 2026-10-24, see research.md §4. Extension probe configured. |
| 7 | Other AI browsers / agents available | Classes D–F | Record product and version |
| 8 | Assistive tech: macOS Voice Control, Windows Voice Access, a screen reader, switch access | False positives that matter most | Must be done before any responder adds friction |
| 9 | Claude desktop in-app browser | Embedded-agent baseline | First run done 2026-10-24, see research.md §4 |

Record each run's outcome in the README of every detector (`Test results` table) and summarise the matrix in research.md.

## Harness sketches (not committed as dependencies yet)

The repo has zero dependencies on purpose. To run 3–5, install the tools in a scratch folder outside the repo, or add a `tools/harness` workspace in a later PR.

```js
// playwright-run.mjs — npm i playwright && npx playwright install chromium
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:8787/apps/lab/');
await page.fill('input[name=username]', 'test-user');
await page.fill('input[name=password]', 'not-a-real-password');
await page.click('button[type=submit]');
await page.click('text=Approve transfer');
await page.click('text=Delete record');
await page.type('#notes', 'First sentence. Second sentence.', { delay: 50 });
const rows = await page.$$eval('#records tr', (trs) => trs.map((tr) => tr.innerText));
console.log(rows.length);
await page.fill('#run-label', 'playwright-default');
await page.waitForTimeout(3000); // let the http-log sink flush
await browser.close();
```

Run it headed and headless (`headless: true`) as separate runs. The server log captures results even without pressing Export.

## What counts as a result

For each run and detector: final status, the evidence object, and the time it first changed. A detector's false-positive rate is the share of run-1/2/8 sessions where it reached `suspicious` or `detected`.
