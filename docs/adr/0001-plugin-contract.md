# ADR 0001 — Everything is a plugin; plugins never import

Date: 2026-10-24 · Status: accepted

## Context

New ways of detecting and handling agents will keep appearing, and many people will add them in parallel. A single file (the original lab spec) does not scale to that; neither does a plugin system where plugins import shared helpers and each other.

## Decision

- Detection, response and log shipping are all plugins of three kinds: `detector`, `responder`, `sink`.
- A plugin is a plain object default-exported from `plugins/<kind>s/<name>/index.js`.
- Plugins do not import modules. The runtime passes everything through `ctx` (environment, pristine natives, logging, reporting, listeners, safe API observation, DOM ownership).
- Plugins are discovered by folder; the id is derived from the path.

## Consequences

- Plugins can be loaded in any order, tested in Node with fakes, reviewed in isolation and concatenated into one file without a bundler.
- Shared helpers must go into `ctx` (a core change) instead of a shared module. This is deliberate friction: the `ctx` surface is the stable API.
- Adding a plugin never edits a shared file, so parallel contributions do not conflict.
