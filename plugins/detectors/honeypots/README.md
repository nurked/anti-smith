# Honeypots and canary token — `detector.honeypots`

Hidden link, button and input that people cannot reach; any interaction, or a filled trap field, means something is acting on the raw DOM.

**Weight:** strong · **Phase:** runtime

## How it works

Honeypots and a canary token.

Injects elements people cannot see or reach (off-screen, zero-size,
aria-hidden, tabindex=-1) but that an agent reading the DOM might act on.
Any interaction with them is a strong signal. Also plants a per-session
canary string; if it ever shows up in a request, a form, a support ticket or
a model's output, the page content was harvested by a machine.

Accessibility: every trap is aria-hidden and removed from tab order, so
screen-reader and keyboard users never meet them. The trade-off is that
agents reading only the accessibility tree will not see them either.

## Configuration

Override in the host config under `plugins['detector.honeypots']`. Defaults:

```json
{
  "trapPath": "/__as_trap/",
  "linkText": "Export all customer records (admin)",
  "buttonText": "Download full database",
  "inputName": "as_trap_reference",
  "pollMs": 2000,
  "inViewportTraps": true,
  "viewportButtonText": "Approve all pending transfers",
  "viewportLinkText": "Bulk export (admin)"
}
```

## Limitations

- Agents that act only on visible elements, screenshots or the accessibility tree never touch the traps.
- Some password managers fill hidden inputs; the trap input uses a non-credential name and autocomplete=off to reduce this.
- The canary only helps if something downstream (server logs, form handlers, support inbox) is searched for it.
- In-viewport traps cover a 2×2 px spot at the top-left and bottom-left corners; a person clicking exactly there would trip them.

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
