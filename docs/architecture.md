# Architecture

anti-smith is a small engine plus many independent plugins. The engine knows nothing about specific agents; every way of spotting or handling an agent is a plugin, so new techniques land as new folders, not as edits to shared code.

```
             ┌──────────────────────────── page ───────────────────-──────────┐
             │                                                                │
 plugins/    │   ┌──────────┐ report/escalate ┌──────────────┐  score         │
 detectors/* ├──▶│ detector │────────────────▶│              │──────────────┐ │
             │   └──────────┘                 │   runtime    │              ▼ │
             │   ┌──────────┐     ctx.log     │  (core)      │      ┌───────────┐
             │   │ detector │────────────────▶│  findings    │      │ responder │ onScore()
             │   └──────────┘                 │  scoring     │      └───────────┘
             │        ▲ ctx.on / observe…     │  event log ──┼──▶ ┌──────┐.   │
             │        │                       │  ownership   │    │ sink │ onEvent() ──▶ POST /log
             │      DOM, events, APIs         └──────────────┘    └──────┘.   │
             └────────────────────────────────────────────────────────────────┘
```

## Repository layout

```
packages/
  core/        runtime, plugin contract, scoring, event log, DOM ownership (no dependencies)
  testkit/     run a plugin in Node with fake browser globals
plugins/
  detectors/<name>/   index.js · index.test.js · README.md
  responders/<name>/
  sinks/<name>/
apps/
  lab/         research page (index.html, lab.js, lab.config.js) and server.mjs
tools/         check-plugins, new-plugin, gen-catalog, lib/discover-plugins
docs/          research, architecture, plugin API, test plan, roadmap, ADRs, catalog
var/           local logs (git-ignored)
```

## Plugin kinds

| Kind | Implements | Purpose |
| --- | --- | --- |
| `detector` | `start(ctx)` | Observes the environment and reports a finding: `{ status, weight, evidence }`. |
| `responder` | `onScore(result, ctx)` | Decides what to do with the score. v0 has only the `on-detected` stub; nothing blocks. |
| `sink` | `onEvent(event, ctx)` | Ships events somewhere (HTTP, console, analytics). |

Planned kinds (not implemented yet, see [roadmap.md](roadmap.md)): `list` (signal data such as automation globals and extension IDs, versioned separately from code) and `server-check` (server-side signals such as Web Bot Auth verification).

## Lifecycle

1. The host page (the lab, later the embed script) imports plugins and calls `createRuntime({ plugins, config })`. Plugins are validated on registration; an invalid plugin fails loudly.
2. `runtime.start()`:
   - snapshots the DOM so existing nodes count as the page's own;
   - creates a context per enabled plugin;
   - subscribes sinks to the event log first, so they see everything;
   - marks every detector `pending`;
   - calls `start(ctx)` for sinks, then responders, then detectors. Synchronous parts run in that order; async detectors settle in parallel.
3. Detectors report with `ctx.report()` (set) or `ctx.escalate()` (never lowers the status). Every change re-scores and calls each responder's `onScore`.
4. `runtime.stop()` runs cleanups in reverse (detectors, responders, sinks), restoring any observed APIs and letting sinks flush.

A plugin that throws is isolated: its finding becomes `error`, a `plugin.error` event is logged, and every other plugin keeps running. Observed API wrappers (`ctx.observeCall`, `ctx.observeGetter`) always return the original result, so a detector bug cannot change page behaviour.

## Key design decisions

- **Plugins never import.** Everything arrives through `ctx`. Plugins can be loaded in any order, tested with fakes, bundled trivially and reviewed in isolation. ([ADR 0001](adr/0001-plugin-contract.md))
- **Native ES modules, no build step, no runtime dependencies.** The lab runs from source; `node --test` is the test runner. ([ADR 0002](adr/0002-no-build-step.md))
- **Detect only until measured.** Weights and responses change only with evidence from test runs. ([ADR 0003](adr/0003-detect-only.md))
- **Privacy by construction.** No key values, typed text or field values in events. ([ADR 0004](adr/0004-privacy-of-evidence.md))
- **Discovery by folder.** The server lists `plugins/<kind>s/<name>/index.js`; the id is derived from the path. Adding a plugin never touches a shared registry file, so contributors do not collide.

## DOM ownership

DOM-diff detectors need to know which changes the page made. The runtime claims every node present at start, plugins claim nodes they insert (`ctx.own(node)` before insertion), host pages claim nodes they create later (`runtime.claim(node)`), and any subtree under `[data-as-ignore]` is skipped. Real sites with client-side rendering will need an integration (a framework hook that claims rendered roots); this is an open item.

## Scoring

Default scorer: `strong` 40 points, `medium` 15, `weak` 5; `suspicious` counts half; capped at 100. Levels: `clean` < 15 ≤ `suspicious` < 40 ≤ `likely-agent`. The scorer is replaceable (`createRuntime({ scorer })`) — expect it to become a plugin once we have enough labelled runs to fit weights.

## Scaling to many contributors

- **Ownership by folder.** Each plugin folder has owners in `CODEOWNERS`; core changes need core maintainers.
- **Maturity.** New detectors start at `weight: 'weak'`. Raising a weight requires results from the test-plan runs in the plugin README (including false-positive runs).
- **Contract stability.** The `ctx` API and plugin shape are versioned with `@anti-smith/core`. Additive changes only within a major version; removals need an ADR.
- **Generated docs.** `docs/plugin-catalog.md` is generated from plugin metadata (`node tools/gen-catalog.mjs`), so it cannot drift.
- **Local checks.** `npm run verify` runs the plugin contract check and all tests. No hosted CI is configured; run it before every pull request.
