# Keyboard dynamics — `detector.keyboard-dynamics`

Inter-key interval variance, and text inserted through input events without a preceding keydown.

**Weight:** medium · **Phase:** runtime

## How it works

Typing rhythm and text that appears without key presses.

People type with irregular gaps. Automation types with near-constant gaps
(`page.type(…, { delay })`) or inserts text with no keydown at all
(Playwright `fill()`, CDP Input.insertText).

Privacy: only timestamps and lengths are kept — never keys or text.

## Configuration

Override in the host config under `plugins['detector.keyboard-dynamics']`. Defaults:

```json
{
  "burstGapMs": 1500,
  "minKeys": 8,
  "regularCv": 0.1,
  "superhumanMedianMs": 25,
  "keylessWindowMs": 60,
  "bulkChars": 4,
  "minKeyless": 2
}
```

## Limitations

- Dictation, IME composition and some accessibility keyboards insert text without keydown events.
- Password managers and browser autofill are excluded by inputType, but not all of them set it.
- Agents adding random, human-speed delays between keystrokes will pass the rhythm and speed checks.
- Text expanders and keyboard macros also type faster than people; superhuman speed alone is only suspicious.

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
