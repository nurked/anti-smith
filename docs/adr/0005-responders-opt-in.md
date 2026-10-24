# ADR 0005 — Responders are opt-in and add friction, never deny on behaviour

Date: 2026-10-24 · Status: accepted · Amends [ADR 0003](0003-detect-only.md)

## Context

Measurement (research.md §4) shows every tested automation framework and Claude in Chrome is caught, mostly by behavioural signals. Those same signals have not been measured on people, and they overlap with assistive technology. Phase 3 adds the first plugins that change the page.

## Decision

- Responders that change the page (`responder.redact`, `responder.step-up`) are **disabled by default**. A host enables them per page; the lab enables them with `?enable=<id>,<id>`.
- `responder.notify-server` changes nothing on the page and may be enabled freely.
- A behavioural score may only **add friction**: hide sensitive values until the person reveals them with a real (trusted) click or key press, and optionally require WebAuthn user verification for each reveal. It never blocks the page or removes the human path.
- **Denial** is reserved for deterministic signals (a signed agent on a deny-list, honeypot interaction, untrusted events on a sensitive action) and is not implemented yet.
- Step-up verifies assertions **on the server** against credentials registered outside the suspicious session. An agent that can inject a virtual authenticator through CDP cannot produce a valid assertion for the person's real credential. On-demand registration exists only in the lab, for testing.
- Redaction removes values from the DOM (not just visually), keeps them only in memory, re-hides revealed values after a timeout, and keeps masked fields operable by keyboard and screen readers.

## Consequences

- ADR 0003's "v0 never changes the page" now holds only for the default configuration.
- Values read before the score crosses the threshold are already gone; pages with the most sensitive data should use `mode: 'always'` (hidden until revealed, whatever the score).
- Assistive-technology runs (test plan #8) are required before enabling redaction on any real page.
