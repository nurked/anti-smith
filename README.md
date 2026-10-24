# anti-smith

Site-side defence against browser automation and AI agents on pages with sensitive personal data. Think "uBlock Origin, installed by the website": a small engine plus community-maintained plugins, each one a way of spotting (and later handling) an agent.

**Status: research lab, detect-only.** Nothing is blocked. The first job is to measure which traces Playwright, Puppeteer, stealth kits, extension agents such as Claude for Chrome, agentic browsers and computer-use agents actually leave — and how often people (including assistive-technology users) leave the same traces.

## Quick start

Requires Node 20+. No `npm install` needed — there are no dependencies.

```bash
npm start
```

Open http://127.0.0.1:8787/apps/lab/ — a dashboard of every detector, a live event log with JSON export, and a test area (login form, buttons, a fake sensitive table, links, a textarea) for agents to act on. Events are also appended to `var/detections.log`.

Useful URL parameters: `?skip=detector.debugger-timing` (stop debugger pauses), `?only=detector.mouse-dynamics,detector.input-trust`.

```bash
npm run verify
```

Checks every plugin against the contract and runs all tests (locally; no hosted CI is configured).

## What is in the box

| Path | What |
| --- | --- |
| [`packages/core`](packages/core/src) | Runtime: plugin contract, scoring, event log, DOM ownership, safe API observation |
| [`packages/testkit`](packages/testkit/src) | Run a plugin in Node with fake browser globals |
| [`plugins/detectors`](plugins/detectors) | 18 detectors: webdriver, automation globals, headless signs, permission consistency, patched natives, CDP console probe, debugger timing, foreign DOM, untrusted events, mouse/keyboard dynamics, focus/scroll/hidden-tab input, interaction timing, scroll-then-click, sensitive reads, capture hints, extension probe, honeypots + canary |
| [`plugins/responders`](plugins/responders) | `on-detected` stub hook |
| [`plugins/sinks`](plugins/sinks) | `http-log` (batches to `POST /log`, `sendBeacon` on hide) |
| [`apps/lab`](apps/lab) | The lab page and its server |
| [`tools/harness`](tools/harness) | Drives the lab with Playwright, Puppeteer (+ stealth) and Selenium; prints a detection matrix (own dependencies) |
| [`docs/`](docs) | Research, architecture, plugin API, test plan, roadmap, ADRs, generated catalog |

## Read next

1. [docs/research.md](docs/research.md) — threat model, what a page can and cannot see, signal catalogue, first results, the layers beyond client-side detection
2. [docs/architecture.md](docs/architecture.md) — how the engine and plugins fit together
3. [docs/plugin-api.md](docs/plugin-api.md) — writing a plugin
4. [docs/test-plan.md](docs/test-plan.md) — how runs are done and recorded
5. [CONTRIBUTING.md](CONTRIBUTING.md)

## Add a detector

```bash
npm run new-plugin -- detector my-signal
```

This creates `plugins/detectors/my-signal/` with `index.js`, a test and a README. The lab picks it up on reload — no registry to edit.

## Limits, stated plainly

Client-side detection can be spoofed by whoever controls the browser, and extension agents run inside the user's own signed-in browser with trusted input. This project collects evidence; the durable protections are data minimisation, human-presence checks before revealing sensitive fields, server-side signals and cryptographic agent identification (Web Bot Auth). See research.md §5.

Licence: not chosen yet (see docs/roadmap.md).
