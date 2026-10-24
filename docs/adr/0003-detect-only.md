# ADR 0003 — Detect only until measured

Date: 2026-10-24 · Status: accepted

## Context

Behavioural signals overlap heavily with assistive technology. Blocking on unmeasured signals would lock out people who rely on voice control, switch access or screen readers.

## Decision

- v0 never blocks, hides or changes page behaviour. The only responder is a stub that logs and calls a host hook.
- API observation (`observeCall`, `observeGetter`) always returns the original result.
- A detector's weight may be raised only with test-plan results, including assistive-tech runs, recorded in its README.
- When responders arrive: behaviour-based scores may add friction (redaction, step-up); only deterministic signals may deny access.

## Consequences

- The lab can run on any page without risk to its users.
- Real protection waits for Phase 3; until then, server-side controls and data minimisation are the actual defence.
