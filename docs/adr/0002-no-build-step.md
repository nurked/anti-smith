# ADR 0002 — Native ES modules, no build step, no dependencies

Date: 2026-10-24 · Status: accepted

## Context

The lab spec asked for plain JavaScript with no build step and no CDN. The project also handles sensitive pages, where every dependency is supply-chain risk.

## Decision

- Source is native ES modules served as-is by `apps/lab/server.mjs` (modules need http://, so the lab is served, not opened from disk).
- Zero runtime and dev dependencies. Tests use `node --test`; tooling uses Node built-ins.
- Harness tools that need Playwright or Puppeteer will live in a separate workspace when added, never in core or plugins.

## Consequences

- `npm install` is not needed to run, test or develop.
- A single-file artifact is a later, optional build output (see roadmap), not the source of truth.
- No TypeScript for now; types are documented in docs/plugin-api.md. Revisit when the `ctx` API settles.
