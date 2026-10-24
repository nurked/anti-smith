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
| 3 | Playwright, defaults | Class B | Done 2026-10-24 via `tools/harness` (Chromium headless/headed, WebKit; Firefox build fails on this macOS) |
| 4 | Playwright + stealth (or a patched fork) | Class C | puppeteer-extra-plugin-stealth done 2026-10-24; patched Playwright forks still to do |
| 5 | Puppeteer, Selenium | Class B | Done 2026-10-24 via `tools/harness`, Chrome and Firefox |
| 6 | Claude for Chrome performing the task | Class D | First two sessions done 2026-10-24, see research.md §4. Extension probe configured. |
| 7 | Other AI browsers / agents available | Classes D–F | Record product and version |
| 8 | Assistive tech: macOS Voice Control, Windows Voice Access, a screen reader, switch access | False positives that matter most | Must be done before any responder adds friction |
| 9 | Claude desktop in-app browser | Embedded-agent baseline | First run done 2026-10-24, see research.md §4 |

Record each run's outcome in the README of every detector (`Test results` table) and summarise the matrix in research.md.

## Harness

`tools/harness` drives the lab with Playwright, Puppeteer (plain and with puppeteer-extra stealth) and Selenium, using the same task for every tool, and prints a detector × run matrix. It has its own dependencies so the rest of the repo stays dependency-free.

```bash
cd tools/harness
npm install
npm run setup          # downloads Playwright's Chromium, Firefox and WebKit
npm run run            # every run; or: npm run run -- firefox
```

The lab server must be running (`npm start` in the repo root). Exports and `matrix.md` land in `exports/<date>/`. Puppeteer and Selenium use the Chrome and Firefox installed in `/Applications`.

## What counts as a result

For each run and detector: final status, the evidence object, and the time it first changed. A detector's false-positive rate is the share of run-1/2/8 sessions where it reached `suspicious` or `detected`.
