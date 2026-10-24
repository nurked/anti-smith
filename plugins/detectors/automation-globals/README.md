# Automation framework globals — `detector.automation-globals`

Looks for window/document properties and attributes injected by Playwright, Puppeteer, ChromeDriver/Selenium, PhantomJS and Nightmare.

**Weight:** strong · **Phase:** static

## How it works

Globals and DOM markers left behind by automation frameworks.

Some appear only after the framework starts using a feature (Playwright adds
`__playwright__binding__` on exposeBinding), so the check repeats for a while.

## Configuration

Override in the host config under `plugins['detector.automation-globals']`. Defaults:

```json
{
  "names": [
    "__playwright__binding__",
    "__pwInitScripts",
    "__puppeteer_evaluation_script__",
    "_selenium",
    "callSelenium",
    "_Selenium_IDE_Recorder",
    "__webdriver_evaluate",
    "__selenium_evaluate",
    "__webdriver_script_function",
    "__webdriver_script_func",
    "__webdriver_script_fn",
    "__fxdriver_evaluate",
    "__driver_unwrapped",
    "__webdriver_unwrapped",
    "__driver_evaluate",
    "__selenium_unwrapped",
    "__fxdriver_unwrapped",
    "_WEBDRIVER_ELEM_CACHE",
    "callPhantom",
    "_phantom",
    "__nightmare",
    "domAutomation",
    "domAutomationController"
  ],
  "prefixes": [
    "cdc_",
    "$cdc_",
    "$wdc_",
    "__playwright",
    "__pw_",
    "__puppeteer",
    "__selenium",
    "__webdriver",
    "__nightmare"
  ],
  "documentAttributes": [
    "webdriver",
    "selenium",
    "driver"
  ],
  "pollMs": 2000,
  "pollForMs": 60000
}
```

## Limitations

- Only sees the main world: anything a framework keeps in an isolated world (Playwright utility world, extension content scripts) is invisible.
- Patched ChromeDriver builds rename the cdc_ variables; stealth tooling removes the rest.
- __puppeteer_evaluation_script__ is normally a sourceURL in stack traces, not a global — see detector.sensitive-reads for stack markers.

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
