# Scroll-into-view then click — `detector.scroll-then-click`

A scroll with no wheel, touch, key or pointer input behind it, followed by a click within a few hundred milliseconds.

**Weight:** weak · **Phase:** runtime

## How it works

Agents that click an element by reference first scroll it into view (Playwright `scrollIntoViewIfNeeded`, CDP `DOM.scrollIntoViewIfNeeded`), then click within milliseconds. People scroll with a wheel, trackpad, keys or the scrollbar, and need time to aim after the page moves.

Found while driving the lab with Claude in Chrome on 2026-10-24: an unexplained scroll at 8.50 s, then a click at 8.56 s.

## Configuration

Override in the host config under `plugins['detector.scroll-then-click']`. Defaults:

```json
{
  "explainedWithinMs": 1000,
  "clickWithinMs": 300,
  "detectAfter": 3
}
```

## Limitations

- Only fires when the target was off-screen; agents clicking visible elements never scroll.
- Anchor links, find-in-page and focus-driven scrolling followed by a very fast click could match; the window is kept short to limit this.
- Scrollbar drags send no wheel event; a pointerdown on the scrollbar counts as an explanation, which most browsers provide.

## Test results

| Run | Result | Export file |
| --- | --- | --- |
| Human, plain Chrome | | |
| Claude in Chrome | | |
| Claude desktop in-app browser | | |
