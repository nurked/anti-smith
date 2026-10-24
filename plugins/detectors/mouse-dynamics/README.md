# Mouse dynamics before clicks — `detector.mouse-dynamics`

Per click: number of moves, hover on target, path straightness, exact-centre hit, integer coordinates.

**Weight:** medium · **Phase:** runtime

## How it works

Mouse activity leading up to each click.

People move the mouse a lot, wobble, overshoot and rarely hit the exact
centre of a button. CDP-driven agents typically "teleport" (0–1 mousemove),
move in perfectly straight lines and click the geometric centre of the
target's bounding box.

## Configuration

Override in the host config under `plugins['detector.mouse-dynamics']`. Defaults:

```json
{
  "maxTeleportMoves": 1,
  "centreTolerancePx": 1,
  "straightTolerancePx": 0.75,
  "minPathLengthPx": 40,
  "maxPathPoints": 200,
  "minClicks": 3,
  "detectRatio": 0.66
}
```

## Limitations

- Voice control, switch access and some screen readers also click without moving — never block on this alone.
- Touch and pen are excluded; keyboard-activated clicks (detail = 0) are skipped.
- Agents that synthesise curved, jittery paths with off-centre targets will pass.

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
