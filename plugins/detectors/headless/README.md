# Headless browser signs — `detector.headless`

HeadlessChrome in UA or client hints, empty plugins/languages, UA vs client-hint mismatch, software WebGL renderer, zero outer window size, missing window.chrome.

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
| Playwright default | | |
| Playwright + stealth | | |
| Puppeteer | | |
| Claude for Chrome | | |
