# Focus, scroll and hidden-tab input — `detector.focus-scroll`

Programmatic focus, unexplained scrolling, and input delivered while the page is hidden or unfocused.

**Weight:** medium · **Phase:** runtime

## How it works

Focus, scroll and window-state patterns.

- Focus that moves with no pointer or key press just before it (element.focus()).
- Scrolling with no wheel, touch, key or pointer activity (scrollIntoView before a CDP click).
- Clicks or key presses while the document is hidden or unfocused. A person
  cannot click a hidden tab; an agent driving a background tab can.

## Configuration

Override in the host config under `plugins['detector.focus-scroll']`. Defaults:

```json
{
  "focusWindowMs": 400,
  "scrollWindowMs": 1000,
  "ignoreBeforeMs": 1500,
  "minProgrammatic": 3,
  "unfocusedDetect": 3
}
```

## Limitations

- Autofocus, anchor links, find-in-page, scrollbar drags and smooth-scroll tails cause some unexplained focus/scroll.
- An agent that keeps the tab focused and visible (most do while acting) passes the hidden-input check.
- document.hasFocus and visibilityState are captured at start; patches applied before load can still lie.

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
