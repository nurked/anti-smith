# Foreign DOM changes — `detector.dom-mutations`

MutationObserver over the whole document: injected nodes, scripts, styles, iframes, shadow roots and suspicious attributes the page did not create.

**Weight:** medium · **Phase:** runtime

## How it works

DOM changes the page did not make.

Extension agents usually leave something in the DOM: an overlay, a cursor
highlight, a shadow-root host, injected styles or marker attributes. This
detector watches the whole document and records nodes that are neither
claimed by the page (see core/ownership.js) nor inside an ignored subtree.

## Configuration

Override in the host config under `plugins['detector.dom-mutations']`. Defaults:

```json
{
  "maxLogged": 200,
  "snippetChars": 240,
  "riskyTags": [
    "script",
    "style",
    "link",
    "iframe",
    "object",
    "embed",
    "canvas"
  ],
  "attributePatterns": [
    "^data-(?:pw|playwright|agent|ref|claude|browser-use|highlight)",
    "^__",
    "^cdp"
  ]
}
```

## Limitations

- Many ordinary extensions (password managers, Grammarly, translators, ad blockers) inject DOM too, so this tops out at suspicious.
- Closed shadow roots and shadow roots attached from an isolated world are not visible; only main-world attachShadow calls are observed.
- Pages that build DOM at runtime must claim their nodes (runtime.claim) or mark containers with data-as-ignore, or they will flag themselves.

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
