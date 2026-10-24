# Debugger pause timing — `detector.debugger-timing`

Times a debugger statement; a long gap means a debugger with active breakpoints is attached.

**Weight:** weak · **Phase:** runtime · **Noisy**

## How it works

`debugger` statement timing. If a debugger is attached with breakpoints
active, the statement pauses execution and the elapsed time jumps.

WEAK and NOISY: this mostly catches humans with DevTools open, and it will
pause their page every interval. Disable with ?skip=detector.debugger-timing.

## Configuration

Override in the host config under `plugins['detector.debugger-timing']`. Defaults:

```json
{
  "initialDelayMs": 1500,
  "intervalMs": 30000,
  "thresholdMs": 100
}
```

## Limitations

- Automation frameworks rarely enable the Debugger domain, so this mostly measures DevTools users.
- Interrupts anyone with DevTools open at every check.
- Busy main threads can create false long gaps; the threshold is generous for that reason.

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
