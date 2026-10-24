# Headless browser signs — `detector.headless`

HeadlessChrome in UA or client hints, values no real browser produces (non-ANGLE WebGL on desktop Chromium, invalid client-hint platform), empty plugins/languages, UA vs client-hint mismatch, software WebGL, zero outer window size, missing window.chrome.

**Weight:** medium · **Phase:** static

## How it works

Classic headless-browser tells. Each check is cheap and individually weak;
the plugin reports which ones fired so runs can be compared.

## Configuration

Override in the host config under `plugins['detector.headless']`. Defaults:

```json
{
  "softRenderers": [
    "SwiftShader",
    "llvmpipe",
    "softpipe",
    "Mesa OffScreen",
    "Google SwiftShader"
  ]
}
```

## Limitations

- New headless Chrome (--headless=new) and stealth plugins fix most of these.
- Software WebGL (SwiftShader, llvmpipe) also appears in VMs, remote desktops and GPU-blocklisted machines.
- Extension agents run in a real headed browser and pass every check.

## Test results

Fill in from the runs in [docs/test-plan.md](../../../docs/test-plan.md).

| Run | Result | Export file |
| --- | --- | --- |
| Human, plain Chrome | | |
| Human, DevTools open | | |
| Playwright default | **detected** headless (HeadlessChrome UA); clean headed | exports/2026-10-24 |
| Playwright + stealth | puppeteer-extra stealth: **detected** — non-ANGLE renderer, "Mac OS X" client-hint platform | exports/2026-10-24 |
| Puppeteer | **detected** (HeadlessChrome UA) | exports/2026-10-24 |
| Claude for Chrome | clean, or suspicious when the tab opens in a background window (outer size 0×0) | exports/2026-10-24 |
