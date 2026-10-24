# Untrusted (synthetic) events — `detector.input-trust`

Records isTrusted for clicks, keys, input, focus, submit and pointer events; any untrusted user event is a script pretending to be a user.

**Weight:** strong · **Phase:** runtime

## How it works

Event.isTrusted on every user-facing event.

Events dispatched by script (element.click(), dispatchEvent) — including from
extension content scripts — arrive with isTrusted === false. Input sent
through CDP (Input.dispatchMouseEvent / dispatchKeyEvent) is trusted, so a
clean result here says nothing about CDP-driven agents.

## Configuration

Override in the host config under `plugins['detector.input-trust']`. Defaults:

```json
{
  "types": [
    "click",
    "dblclick",
    "mousedown",
    "mouseup",
    "pointerdown",
    "pointerup",
    "keydown",
    "keyup",
    "input",
    "change",
    "submit",
    "focusin",
    "contextmenu",
    "touchstart"
  ],
  "ignoreTypes": [],
  "maxLogged": 500
}
```

## Limitations

- CDP input (Playwright, Puppeteer, chrome.debugger extensions) produces trusted events and passes.
- The page’s own code may dispatch synthetic events (some UI libraries do); list those types in ignoreTypes.
- Never logs key values or typed text — only event types and targets.

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
