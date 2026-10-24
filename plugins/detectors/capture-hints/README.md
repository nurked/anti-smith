# Screenshot / emulation hints — `detector.capture-hints`

Viewport-only resizes, requestAnimationFrame stalls near actions, and visibility changes during activity.

**Weight:** weak · **Phase:** runtime · **Noisy**

## How it works

Hints that something is capturing or emulating the page.

- Viewport-only resizes (inner size changes, outer window does not, zoom
  unchanged): CDP Emulation.setDeviceMetricsOverride, used for full-page
  screenshots and by agents that fix a viewport.
- Animation-frame stalls while the page is visible, near actions: screenshot
  capture can stall the compositor.
- Visibility flips around activity.

## Configuration

Override in the host config under `plugins['detector.capture-hints']`. Defaults:

```json
{
  "stallMs": 250,
  "nearActionMs": 2000,
  "minStalls": 3,
  "maxLogged": 100
}
```

## Limitations

- DevTools device emulation also changes only the viewport; busy main threads also stall frames.
- Screenshots taken by the OS or by a computer-use agent watching the screen leave no trace in the page.
- Unverified hypothesis: whether Page.captureScreenshot stalls frames measurably varies by Chrome version — see docs/test-plan.md.

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
