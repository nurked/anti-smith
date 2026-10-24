# Patched native functions — `detector.native-patches`

Finds built-ins whose source is not "[native code]", that disagree with a pristine iframe toString, or that have the wrong shape — the footprint of stealth plugins.

**Weight:** medium · **Phase:** static

## How it works

Patched built-ins. Stealth plugins override navigator getters, permissions,
WebGL and Function.prototype.toString itself to look human. This detector
stringifies those functions with the page's toString and with a pristine
toString from a fresh iframe, and checks for shape differences (a `prototype`
property on a "native" method, own properties on the navigator instance).

## Configuration

Override in the host config under `plugins['detector.native-patches']`. Defaults:

_None._

## Limitations

- Legitimate libraries patch some of these too (zone.js and error trackers wrap addEventListener; privacy extensions patch canvas). Those count as suspicious, not detected.
- A careful stealth kit patches the iframe realm as well, or uses Proxy objects that stringify as native.
- Patches made by anti-smith itself are skipped via ctx.isOwnPatch().

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
