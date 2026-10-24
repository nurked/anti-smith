# CDP attached (console serialization) — `detector.cdp-console`

Logs objects with getters via console.debug; if a getter fires without DevTools visibly docked, a protocol client is probably attached.

**Weight:** medium · **Phase:** runtime · **Noisy**

## How it works

CDP / inspector attached: console serialization probe.

When a Chrome DevTools Protocol client has the Runtime domain enabled
(Playwright, Puppeteer, Selenium 4, chrome.debugger-based extensions, or
DevTools itself), console arguments are serialised for the client. Getters
on the logged objects can fire during that serialisation. We log an Error
with a `stack` getter and a detached element with an `id` getter and see
whether either getter runs.

NOISY: DevTools being open triggers it too, and V8 changes have broken the
Error.stack variant in recent Chrome versions. Treat results as data to
compare across runs, not as a verdict.

## Configuration

Override in the host config under `plugins['detector.cdp-console']`. Defaults:

```json
{
  "intervalMs": 5000,
  "devtoolsGapPx": 160
}
```

## Limitations

- Fires for humans with DevTools open; undocked DevTools cannot be told apart from automation.
- Recent V8 reads Error.stack internally without calling user getters, which silences the classic variant (reported by Castle, 2025).
- Frameworks that avoid Runtime.enable, and WebDriver BiDi sessions, do not trigger it.

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
