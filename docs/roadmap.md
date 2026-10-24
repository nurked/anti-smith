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
- [ ] Re-fit weights from labelled runs; make the scorer a plugin

## Phase 2 — Signal lists and server side

- [x] `lists/` — versioned signal data (automation globals, stack markers, agent extensions, attribute patterns, renderer names) feeding plugin config; own owners and checks
- [x] `packages/server` — Web Bot Auth verification (RFC 9421, Ed25519), request signals (header order, client hints, Fetch Metadata, edge TLS fingerprint headers), agent user-agent list, session correlation; the lab server runs on it
- [ ] Test Web Bot Auth against a real signed agent; verify directory signatures; nonce replay protection
- [x] Server-side canary scanning: every request URL is scanned and hits are linked to the session that planted the token (`createCanaryScanner().scanValue` for form posts and tickets)

## Phase 3 — Responders

- [ ] `responder.redact` — mask `[data-as-sensitive]` content above a threshold, reveal one field on demand
- [ ] `responder.step-up` — require WebAuthn user verification before reveals
- [ ] `responder.notify-server` — flag the session server-side
- [ ] Policy: deny only on deterministic signals (see research.md §6)

## Phase 4 — Embeddable SDK

- [ ] `packages/embed` — script-tag/npm entry with a chosen plugin set, no global runtime handle
- [ ] Framework integrations that claim rendered DOM (React, Vue, server-rendered pages)
- [ ] Hardening: runtime integrity, tamper reporting, server verification of client results
- [ ] Production pilot on one sensitive page, with a DPIA and an accessibility review

## Open decisions

- Licence (needed before outside contributors join)
- Where exports from test runs are stored and who can see them
