# Roadmap

## Phase 0 — Lab (now)

- [x] Core runtime: plugin contract, scoring, event log, DOM ownership, safe API observation
- [x] 18 detectors (17 from the handoff spec, plus scroll-then-click from the Claude in Chrome run), `on-detected` stub responder, HTTP log sink
- [x] Lab page and local server with JSON-lines log, honeypot and canary endpoints
- [x] Contract checker, scaffolder, generated catalog, unit tests
- [x] Claude for Chrome extension ID and web-accessible paths configured (refresh the hashed paths on each release)

## Phase 1 — Measurement

- [x] `tools/harness`: Playwright, Puppeteer (+ stealth), Selenium runs as scripts, with a results matrix
- [ ] Harness runs for patched Playwright forks and other anti-detect browsers
- [ ] Run the full [test plan](test-plan.md), including assistive-tech sessions
- [ ] Results matrix in research.md; per-detector results in each README
- [x] Scorer is a plugin kind; `scorer.evidence-classes` adds deterministic / environment / behaviour breakdown (ADR 0005)
- [ ] Re-fit weights from labelled runs (needs human and assistive-tech sessions)

## Phase 2 — Signal lists and server side

- [x] `lists/` — versioned signal data (automation globals, stack markers, agent extensions, attribute patterns, renderer names) feeding plugin config; own owners and checks
- [x] `packages/server` — Web Bot Auth verification (RFC 9421, Ed25519), request signals (header order, client hints, Fetch Metadata, edge TLS fingerprint headers), agent user-agent list, session correlation; the lab server runs on it
- [ ] Test Web Bot Auth against a real signed agent; verify directory signatures; nonce replay protection
- [x] Server-side canary scanning: every request URL is scanned and hits are linked to the session that planted the token (`createCanaryScanner().scanValue` for form posts and tickets)

## Phase 3 — Responders

- [x] `responder.redact` — removes sensitive values from the DOM (always or above a threshold); one field at a time on a trusted click/key, optionally behind step-up
- [x] `responder.step-up` + server WebAuthn (ES256/EdDSA, UV required, single-use challenges, counters); `tools/harness/step-up-check.mjs` shows a virtual authenticator cannot pass for a registered credential
- [x] `responder.notify-server` — flags the session server-side at each new level
- [x] Policy: responders opt-in, behaviour adds friction only ([ADR 0005](adr/0005-responders-opt-in.md))
- [ ] Deny responder for deterministic signals (signed agent on a deny-list, honeypot hit, untrusted events on sensitive actions)
- [ ] Assistive-technology runs before enabling redaction anywhere real

## Phase 4 — Embeddable SDK

- [x] `packages/embed` — `startAntiSmith()` for bundled apps and a script-tag bootstrap (`auto.js`), narrow handle, no global; see `apps/embed-demo`
- [x] Framework integrations via `adoptPending()` (React layout-effect hook, Vue plugin, htmx/Turbo/Unpoly swap events, plain `rendering()`)
- [ ] Verify the Vue integration's timing against the MutationObserver in a real Vue app
- [ ] Hardening: runtime integrity, tamper reporting, server verification of client results
- [ ] Production pilot on one sensitive page, with a DPIA and an accessibility review

## Open decisions

- Licence (needed before outside contributors join)
- Where exports from test runs are stored and who can see them
