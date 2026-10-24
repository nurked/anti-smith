# ADR 0004 — Evidence never contains what people typed or read

Date: 2026-10-24 · Status: accepted

## Context

The lab runs on pages with very sensitive personal data and records detailed behaviour. Without rules, logs become a second copy of that data, plus behavioural biometrics.

## Decision

- Events and evidence never include key values, typed text, field values, or text of sensitive elements.
- Keyboard and mouse detectors keep timings, counts and flags only.
- `describeNode` keeps identifying attributes; full snippets only for nodes the page did not create.
- Reviewers reject plugins that break these rules regardless of detection value.

## Consequences

- Some forensic detail is lost (we cannot see *what* an agent typed).
- Exports and server logs can be shared within the team for research with less risk; retention still needs a decision before production use.
