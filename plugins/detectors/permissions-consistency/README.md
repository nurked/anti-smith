# Notification permission consistency — `detector.permissions-consistency`

Compares Notification.permission with navigator.permissions.query({ name: "notifications" }).

**Weight:** medium · **Phase:** static

## How it works

Notification permission consistency. Old headless Chrome reported
Notification.permission "denied" while permissions.query said "prompt".

## Configuration

Override in the host config under `plugins['detector.permissions-consistency']`. Defaults:

_None._

## Limitations

- Fixed in new headless Chrome and patched by stealth plugins.
- Some privacy extensions and enterprise policies also produce mismatches.

## Test results

Fill in from the runs in [docs/test-plan.md](../../../docs/test-plan.md).

| Run | Result | Export file |
| --- | --- | --- |
| Human, plain Chrome | | |
| Human, DevTools open | | |
| Playwright default | | |
| Playwright + stealth | | |
| Puppeteer | | |
| Claude for Chrome | | |
