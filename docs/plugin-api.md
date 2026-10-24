# Plugin API

A plugin is the default export of `plugins/<kind>s/<name>/index.js`. It is a plain object and **must not import anything** — the runtime passes everything through `ctx`.

Scaffold one with:

```bash
npm run new-plugin -- detector my-signal
```

## Plugin object

| Field | Required | Notes |
| --- | --- | --- |
| `id` | yes | `<kind>.<kebab-name>`, must match the folder: `plugins/detectors/my-signal` → `detector.my-signal` |
| `kind` | yes | `detector` · `responder` · `sink` |
| `version` | yes | semver |
| `title`, `description` | yes | Shown in the lab and the generated catalog |
| `weight` | detectors | `strong` · `medium` · `weak`. New detectors start at `weak`. |
| `limitations` | detectors | At least one. What it misses and what it falsely flags. Shown in the lab. |
| `start(ctx)` | detectors | May be async. May return a cleanup function. |
| `onScore(result, ctx)` | responders | Called after every finding change. |
| `onEvent(event, ctx)` | sinks | Called for every event, including those logged before `start`. |
| `phase` | no | `static` (checks once) or `runtime` (keeps watching). Informational. |
| `noisy` | no | `true` when false positives are expected (DevTools users etc.). Shown in the UI and score. |
| `tags` | no | Free-form strings. |
| `defaults` | no | Config defaults; the host overrides them under `config.plugins[id]`. `enabled: false` disables the plugin. |

No top-level side effects: importing the module in Node must not touch `window` or `document` (`npm run check` imports every plugin to enforce this).

## Context (`ctx`)

| Member | Purpose |
| --- | --- |
| `id`, `sessionId` | Plugin id; random id of this runtime session |
| `config` | Frozen merge of `defaults` and host config |
| `state` | Mutable object for this plugin in this runtime. Keep state here, never in module scope. |
| `window`, `document` | The environment (fakes in tests) |
| `natives` | Built-ins captured at runtime creation: `now`, timers, `requestAnimationFrame`, `defineProperty`, `consoleDebug`, `querySelectorAll`, `getSelection`, `fnToString` |
| `STATUS` | Status constants |
| `now()` | Milliseconds since the runtime started |
| `report(finding)` | Set this detector's finding: `{ status, evidence?, weight? }` |
| `escalate(finding)` | Same, but ignored if it would lower the status |
| `finding()`, `findings()` | Current finding of this plugin / of all detectors |
| `log(type, data)` | Append an event (raw observation) without changing the finding |
| `subscribe(fn)` | Receive every event (for composite detectors) |
| `on(target, type, handler, options?)` | `addEventListener` with auto-cleanup and error isolation. Default `{ capture: true, passive: true }` |
| `every(ms, fn)`, `after(ms, fn)` | Timers with auto-cleanup |
| `onCleanup(fn)` | Run on stop |
| `observeCall(target, key, fn)` | Watch calls to a method. The original runs and its result is returned untouched; `fn({ thisArg, args, result })` runs after. Restored on stop. |
| `observeGetter(target, key, fn)` | Same for accessors; works on instances (one element) or prototypes |
| `isNative(fn)`, `isOwnPatch(fn)` | Native-looking source check; whether a function is one of anti-smith's own observers |
| `own(node)`, `isOwned(node)`, `isIgnored(node)` | DOM ownership (see architecture.md) |
| `describe(node, { snippet? })` | Privacy-safe node description for evidence |

## Data shapes

**Finding**

```js
{ id, title, status, weight, noisy, evidence, reports, updatedAt }
// status: pending | unsupported | error | clean | suspicious | detected
```

**Event**

```js
{ seq, t /* ms since start */, at /* ISO time */, source /* plugin id or "core" */, type, data }
```

**Score result** (what responders receive)

```js
{ score /* 0–100 */, level /* clean | suspicious | likely-agent */, contributors: [{ id, title, status, weight, noisy, points }] }
```

**Export** (`runtime.exportJSON(meta)`, the lab's Export button)

```js
{ format: 'anti-smith.export/v1', exportedAt, sessionId, meta, score, findings, plugins, log: { dropped, events } }
```

## Rules for evidence

- Keep it small and JSON-serialisable.
- Never include key values, typed text, field values or the text of sensitive elements. Lengths, counts, timings and attribute names are fine.
- Use `ctx.describe(node)` for elements; pass `{ snippet: true }` only for nodes the page did not create.
- Rate-limit `ctx.log` in anything that fires on high-frequency events (see `maxLogged` in existing plugins).

## Status guidance

| Status | Use when |
| --- | --- |
| `unsupported` | The API this detector needs is missing — not evidence either way |
| `clean` | Checked, nothing found |
| `suspicious` | Consistent with automation but common for people too |
| `detected` | People essentially never produce this |
| `error` | Set by the runtime when the plugin throws |

## Testing

```js
import { runPlugin, fakeWindow } from '../../../packages/testkit/src/index.js';
import plugin from './index.js';

const run = await runPlugin(plugin, { window: fakeWindow({ navigator: { webdriver: true } }) });
assert.equal(run.finding().status, 'detected');
run.stop(); // always, if the plugin starts timers
```

Static detectors are easy to unit-test with fakes. Behavioural detectors need a real browser; record their results in the plugin README from the runs in [test-plan.md](test-plan.md).
