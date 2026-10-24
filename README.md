# anti-smith

Site-side defence against browser automation and AI agents on pages with sensitive personal data. Think "uBlock Origin, installed by the website": a small engine plus community-maintained plugins, each one a way of spotting (and later handling) an agent.

**Status: research lab.** Detection is on by default; responders that change the page (redaction, WebAuthn step-up) are opt-in and never block — see ADR 0005. The first job is to measure which traces Playwright, Puppeteer, stealth kits, extension agents such as Claude for Chrome, agentic browsers and computer-use agents actually leave — and how often people (including assistive-technology users) leave the same traces.

**→ [How to use it](docs/getting-started.md)** — install it on your site, step by step.

## Quick start

Requires Node 20+. No `npm install` needed — there are no dependencies.

```bash
npm start
```

Open http://127.0.0.1:8787/apps/lab/ — a dashboard of every detector, a live event log with JSON export, and a test area (login form, buttons, a fake sensitive table, links, a textarea) for agents to act on. Events are also appended to `var/detections.log`.

Fake CRM for testing protection levels: http://localhost:8787/crm (switch levels in its header; `?threshold=N` changes how early protection engages; the Test controls box forces a layer on demand).

Useful URL parameters: `?skip=detector.debugger-timing` (stop debugger pauses), `?only=detector.mouse-dynamics,detector.input-trust`, `?enable=responder.redact,responder.step-up` (opt-in responders; open the lab on http://localhost:8787 for WebAuthn).

```bash
npm run verify
```

Checks every plugin against the contract and runs all tests (locally; no hosted CI is configured).

## What is in the box

| Path | What |
| --- | --- |
| [`packages/core`](packages/core/src) | Runtime: plugin contract, scoring, event log, DOM ownership, safe API observation |
| [`packages/testkit`](packages/testkit/src) | Run a plugin in Node with fake browser globals |
| [`packages/server`](packages/server/src) | Web Bot Auth verification, request signals, canary scanning, session correlation, WebAuthn step-up, HTTP handler |
| [`packages/embed`](packages/embed/src) | Put anti-smith on a real page: `startAntiSmith()`, script-tag bootstrap, React/Vue/htmx integrations |
| [`lists`](lists) | Signal data (automation globals, agent extensions, agent user agents, …), versioned separately from code |
| [`plugins/detectors`](plugins/detectors) | 18 detectors: webdriver, automation globals, headless signs, permission consistency, patched natives, CDP console probe, debugger timing, foreign DOM, untrusted events, mouse/keyboard dynamics, focus/scroll/hidden-tab input, interaction timing, scroll-then-click, sensitive reads, capture hints, extension probe, honeypots + canary |
| [`plugins/responders`](plugins/responders) | `on-detected` hook, `notify-server`, opt-in `redact` + `step-up` (WebAuthn), and protection levels `agent-banner`, `lockout`, `agent-notice` |
| [`plugins/scorers`](plugins/scorers) | `evidence-classes`: weighted score plus deterministic / environment / behaviour breakdown |
| [`plugins/sinks`](plugins/sinks) | `http-log` (batches to `POST /log`, `sendBeacon` on hide) |
| [`apps/lab`](apps/lab) | The lab page and its server |
| [`apps/embed-demo`](apps/embed-demo) | A page using `packages/embed` the way a real site would |
| [`apps/crm`](apps/crm) | **Northwind CRM**, a fake five-page CRM for testing: each page integrates anti-smith differently, with protection levels 1–3 (banner, content lockout, agent notice) |
| [`tools/harness`](tools/harness) | Drives the lab with Playwright, Puppeteer (+ stealth) and Selenium; prints a detection matrix (own dependencies) |
| [`docs/`](docs) | Research, architecture, plugin API, test plan, roadmap, ADRs, generated catalog |

## Read next

0. [docs/getting-started.md](docs/getting-started.md) — how to install and use it on your site
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
