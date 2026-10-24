# Contributing

Thanks for helping. The project is built so that many people can work in parallel without stepping on each other: most contributions are a new folder under `plugins/`.

## Setup

```bash
git clone <repo> && cd anti-smith
npm start          # lab at http://127.0.0.1:8787/apps/lab/
npm run verify     # contract check + all tests
```

Node 20+, nothing to install. Checks run locally — there is no hosted CI. Run `npm run verify` before every pull request and paste its last lines into the PR description.

## Kinds of contribution

| You want to… | Do this |
| --- | --- |
| Add a new way of spotting agents | `npm run new-plugin -- detector <name>` |
| Add a response (redact, step-up, notify) | `npm run new-plugin -- responder <name>` — read ADR 0003 first |
| Ship events somewhere | `npm run new-plugin -- sink <name>` |
| Report test results | Update the `Test results` table in the detector's README and research.md |
| Change the engine or `ctx` API | Open an issue first; non-additive changes need an ADR in `docs/adr/` |
| Change research conclusions | Edit docs/research.md with sources; mark untested claims as **hypothesis** |

## Plugin rules (enforced in review; some by `npm run check`)

1. **No imports.** Use `ctx`. Need a shared helper? Propose adding it to `ctx`.
2. **No top-level side effects.** Touch `window`/`document` only inside `start()`.
3. **State in `ctx.state`**, never in module scope.
4. **Never change page behaviour.** Observe with `ctx.observeCall` / `ctx.observeGetter`; no blocking, no `preventDefault`, no dispatching events into the page.
5. **Privacy.** No key values, typed text, field values or sensitive-element text in evidence or logs (ADR 0004). Use `ctx.describe(node)`.
6. **Honest limitations.** Every detector lists what it misses and what it falsely flags — always including assistive technology when the signal is behavioural.
7. **Start weak.** New detectors use `weight: 'weak'`. Raising the weight needs test-plan results (including human and assistive-tech runs) in the README.
8. **Bounded cost.** Rate-limit logging on high-frequency events; no work in `mousemove` beyond counters and small arrays.
9. **Accessibility.** Anything injected into the page must be invisible to assistive technology and out of the tab order.
10. **Tests.** Unit-test with `packages/testkit` wherever fakes can express the signal.

## Review checklist

- [ ] `npm run verify` passes
- [ ] README explains the signal, false positives and config
- [ ] Limitations are specific and honest
- [ ] Evidence is small and contains no personal data
- [ ] Weight is justified by recorded runs (or is `weak`)
- [ ] `node tools/gen-catalog.mjs` re-run if metadata changed

## Ownership

`CODEOWNERS` maps folders to owners. Plugin authors own their plugin folder; core maintainers own `packages/`, `apps/`, `tools/` and `docs/adr/`. Two approvals for core, one owner approval for a plugin.

## Words

Write plainly. Prefer "how often" or "weekly" over jargon. Do not describe untested behaviour as fact.
