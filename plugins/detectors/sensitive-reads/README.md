# Sensitive content reads — `detector.sensitive-reads`

Watches main-world reads of elements marked sensitive (innerText/textContent/innerHTML, querySelectorAll, getSelection, createRange, copy).

**Weight:** medium · **Phase:** runtime

## How it works

Script reads of sensitive content.

Observes (never alters) the APIs scrapers use: text getters on sensitive
elements and on <body>/<html>, querySelectorAll calls whose results land
inside sensitive elements, getSelection, createRange and copy events. The
page itself never calls these on sensitive content, so any read is notable.
Stack traces reveal who is reading: Puppeteer and Playwright leave
recognisable frames, main-world extension scripts show chrome-extension://.

MAIN WORLD ONLY: extension content scripts run in an isolated world with
their own prototypes, and CDP-based readers (DOM.getDocument,
Accessibility.getFullAXTree, screenshots) never touch page JavaScript.

## Configuration

Override in the host config under `plugins['detector.sensitive-reads']`. Defaults:

```json
{
  "selector": "[data-as-sensitive]",
  "watchDocumentRoots": true,
  "maxLogPerApi": 25,
  "stackMarkers": [
    "__puppeteer_evaluation_script__",
    "pptr:",
    "UtilityScript",
    "__playwright",
    "playwright",
    "selenium",
    "webdriver",
    "chrome-extension://",
    "moz-extension://"
  ],
  "allowStackPatterns": []
}
```

## Limitations

- Only catches scripts in the page main world. Isolated-world content scripts and CDP DOM/accessibility/screenshot reads are invisible.
- Page code (analytics, session replay, rich-text editors) reading the same content will trip it; list known callers in allowStackPatterns.
- new Range() via the constructor is not observed, only document.createRange().

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
