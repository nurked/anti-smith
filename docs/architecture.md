# Architecture

anti-smith is a small engine plus many independent plugins, fed by versioned signal lists, with a server package for what the page cannot see. The engine knows nothing about specific agents: every way of spotting or handling one is a plugin, every piece of signal data is a list entry.

```
 lists/*.json ──────────────┐ (config values)
                            ▼
             ┌─────────────────────────────── page ────────────────────────────────┐
 plugins/    │  ┌──────────┐ report/escalate ┌─────────────┐ score ┌───────────┐   │
 detectors/* ├─▶│ detector │────────────────▶│   runtime   │──────▶│ responder │   │ notify-server, redact,
             │  └──────────┘                 │   (core)    │       └───────────┘   │ step-up (opt-in)
             │       ▲ ctx.on / observe…     │  findings   │◀── scorer plugin      │
             │     DOM, events, APIs         │  services   │──▶ ┌──────┐           │
             │                               │  event log  │    │ sink │──────┐    │
             │                               └─────────────┘    └──────┘      │    │
             └────────────────────────────────────────────────────────────────┼────┘
                                                                              ▼
             ┌──────────────────────────── server (@anti-smith/server) ─────────────────┐
             │ /log  /api/flag  /api/step-up/*  /__as_trap/*   + inspect(every request) │
             │ Web Bot Auth · request signals · agent UA list · canary scan · sessions  │
             └──────────────────────────────────────────────────────────────────────────┘
```

## Repository layout

```
packages/
  core/        runtime, plugin contract, scoring fallback, event log, DOM ownership, services (no dependencies)
  server/      Web Bot Auth, request signals, canary scanning, sessions, WebAuthn step-up, HTTP handler (Node built-ins)
  embed/       startAntiSmith(), script-tag bootstrap, framework integrations
  testkit/     run a plugin in Node with fake browser globals
plugins/
  detectors/<name>/   index.js · index.test.js · README.md
  responders/<name>/
  sinks/<name>/
  scorers/<name>/
lists/         signal data (JSON, versioned by date)
apps/
  lab/         research page and server (built on packages/server)
  embed-demo/  a page using packages/embed the way a real site would
tools/         check-plugins, check-lists, new-plugin, gen-catalog, lib/
tools/harness/ automation runs (Playwright, Patchright, Puppeteer, Selenium) — own dependencies
docs/          research, architecture, plugin API, test plan, roadmap, ADRs, catalog
var/           local logs (git-ignored)
```

## Plugin kinds

| Kind | Implements | Purpose |
| --- | --- | --- |
| `detector` | `start(ctx)` | Observes the environment and reports a finding `{ status, weight, evidence }`. Declares its evidence class. |
| `responder` | `onScore(result, ctx)` | Acts on the score. Page-changing responders are opt-in (ADR 0005). |
| `sink` | `onEvent(event, ctx)` | Ships events somewhere (HTTP, console, analytics). |
| `scorer` | `score(findings, ctx)` | Turns findings into `{ score, level, contributors, … }`. The first enabled scorer decides; the built-in weighted scorer is the fallback. |

**Evidence classes** (ADR 0005): `deterministic` (people essentially never produce it), `environment` (how the browser is set up), `behaviour` (how input arrives). `scorer.evidence-classes` reports which classes contributed; only deterministic evidence may ever justify denial.

## Lifecycle

1. The host imports plugins and calls `createRuntime({ plugins, config, lists })` — or `startAntiSmith()` from `packages/embed`. Plugins are validated on registration.
2. `runtime.start()`:
   - snapshots the DOM so existing nodes count as the page's own;
   - creates a context per enabled plugin, with config = plugin defaults < list values < host config;
   - subscribes sinks to the event log first, so they see everything;
   - marks every detector `pending`;
   - calls `start(ctx)` for scorers, sinks, responders, then detectors. Synchronous parts run in that order; async detectors settle in parallel.
3. Detectors report with `ctx.report()` (set) or `ctx.escalate()` (never lowers). Every change re-scores and calls each responder's `onScore`.
4. `runtime.stop()` runs cleanups in reverse, restoring observed APIs, removing provided services and letting sinks flush.

A plugin that throws is isolated: its finding becomes `error`, a `plugin.error` event is logged, everything else keeps running. Observed API wrappers always return the original result.

## Cooperation without imports

- **Services.** `ctx.provide(name, fn)` / `ctx.service(name)`. `responder.step-up` provides `step-up`; `responder.redact` uses it if present. `detector.dom-mutations` provides `adopt-mutations`, which backs `runtime.adoptPending()`.
- **Event log.** `ctx.subscribe(fn)` for plugins that combine other plugins' observations.
- **Lists.** Shared data, not shared code (lists/README.md).

## DOM ownership on real pages

The runtime claims every node present at start. After that, pages either call `runtime.adoptPending()` synchronously after rendering (it drains the mutation observer's pending records and claims those nodes before they are judged), claim nodes explicitly with `runtime.claim(node)`, or mark containers `data-as-ignore`. `packages/embed/src/integrations.js` wraps this for React (layout effect), Vue (mounted/updated — timing unverified) and swap libraries (htmx, Turbo, Unpoly). Anything injected in the same task as a page render is adopted with it; that window is small but real.

## Server side

`createAntiSmithHandler()` (packages/server) mounts on any Node HTTP server:

- `inspect(req)` for every request: request signals (header order, client hints, Fetch Metadata, TLS, edge fingerprint headers), classification against `lists/agent-user-agents.json`, Web Bot Auth verification (RFC 9421, Ed25519, key directory fetch), canary scanning linked back to the session that planted the token.
- Routes: `POST /log` (sink.http-log), `POST /api/flag` (responder.notify-server), `POST /api/step-up/*` (WebAuthn, verified server-side), `/__as_trap/*` (honeypots).
- A bounded in-memory session store joins client findings and server observations; production replaces it with a shared store of the same shape.

## Key design decisions

- **Plugins never import.** Everything arrives through `ctx`. ([ADR 0001](adr/0001-plugin-contract.md))
- **Native ES modules, no build step, no runtime dependencies** in core, plugins and server. Harness tools live in their own package. ([ADR 0002](adr/0002-no-build-step.md))
- **Detect first; responders opt-in; behaviour adds friction only.** ([ADR 0003](adr/0003-detect-only.md), [ADR 0005](adr/0005-responders-opt-in.md))
- **Privacy by construction.** No key values, typed text or field values in events. ([ADR 0004](adr/0004-privacy-of-evidence.md))
- **Discovery by folder; data in lists.** Adding a plugin or a list entry never touches a shared registry file.

## Scoring

Built-in fallback and `scorer.evidence-classes` share the formula: `strong` 40, `medium` 15, `weak` 5; `suspicious` counts half; capped at 100. Levels: `clean` < 15 ≤ `suspicious` < 40 ≤ `likely-agent`. Weights are starting points until human and assistive-technology baselines exist (research.md §4, fifth observation).

## Scaling to many contributors

- **Ownership by folder** (`CODEOWNERS`): plugins by their authors, lists by list maintainers, core/server/embed by core maintainers.
- **Maturity.** New detectors start at `weight: 'weak'`; raising a weight needs recorded test-plan runs, including false-positive runs.
- **Contract stability.** `ctx`, plugin shape and list format are versioned with `@anti-smith/core`; additive changes only within a major version; removals need an ADR.
- **Generated docs.** `docs/plugin-catalog.md` is generated from plugin metadata.
- **Local checks.** `npm run verify` (plugin contract, lists, all tests). No hosted CI is configured.
