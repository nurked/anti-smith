# Interaction timing — `detector.interaction-timing`

Time to first interaction, regularity of action gaps, and long motionless pauses followed by instant actions.

**Weight:** weak · **Phase:** runtime

## How it works

When actions happen, not how.

- Time from navigation to first interaction (scripts act within milliseconds).
- Regularity of the gaps between actions.
- "Stop and go": LLM agents pause for seconds while the model thinks, with no
  mouse movement at all, then act instantly. People move the mouse while
  reading and on the way to a target.

## Configuration

Override in the host config under `plugins['detector.interaction-timing']`. Defaults:

```json
{
  "fastFirstMs": 500,
  "thinkGapMs": 2000,
  "maxMovesInGap": 2,
  "minActions": 5,
  "regularCv": 0.2,
  "stopAndGoRatio": 0.6
}
```

## Limitations

- Keyboard-only users and people who read without touching the mouse look like stop-and-go.
- Timing alone is easy to randomise; it is a supporting signal only.

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
