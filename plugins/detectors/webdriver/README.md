# navigator.webdriver flag — `detector.webdriver`

Reports navigator.webdriver === true, and Chromium browsers where the property has been deleted (a stealth-plugin habit).

**Weight:** strong · **Phase:** static

## How it works

navigator.webdriver — the flag browsers raise when WebDriver, CDP-launched
automation (Playwright, Puppeteer) or `--enable-automation` controls them.

## Configuration

Override in the host config under `plugins['detector.webdriver']`. Defaults:

_None._

## Limitations

- Hidden by stealth plugins and by launching Chromium with --disable-blink-features=AutomationControlled.
- Extension agents (e.g. Claude for Chrome) run in a normal profile and never set it.

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
