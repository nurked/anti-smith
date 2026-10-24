/**
 * Mouse activity leading up to each click.
 *
 * People move the mouse a lot, wobble, overshoot and rarely hit the exact
 * centre of a button. CDP-driven agents typically "teleport" (0–1 mousemove),
 * move in perfectly straight lines and click the geometric centre of the
 * target's bounding box.
 */
export default {
  id: 'detector.mouse-dynamics',
  kind: 'detector',
  version: '0.1.0',
  title: 'Mouse dynamics before clicks',
  description: 'Per click: number of moves, hover on target, path straightness, exact-centre hit, integer coordinates.',
  weight: 'medium',
  evidence: 'behaviour',
  phase: 'runtime',
  tags: ['behaviour', 'mouse'],
  limitations: [
    'Voice control, switch access and some screen readers also click without moving — never block on this alone.',
    'Touch and pen are excluded; keyboard-activated clicks (detail = 0) are skipped.',
    'Agents that synthesise curved, jittery paths with off-centre targets will pass.',
  ],
  defaults: {
    maxTeleportMoves: 1,
    centreTolerancePx: 1,
    straightTolerancePx: 0.75,
    minPathLengthPx: 40,
    maxPathPoints: 200,
    minClicks: 3,
    detectRatio: 0.66,
  },

  start(ctx) {
    const { document: doc, config } = ctx;
    if (!doc) return ctx.report({ status: 'unsupported', evidence: { reason: 'no document' } });
    const s = ctx.state;
    s.path = [];
    s.hovered = new WeakSet();
    s.pointerType = 'mouse';
    s.clicks = 0;
    s.flagged = 0;
    s.flagCounts = {};

    ctx.on(doc, 'mousemove', (e) => {
      if (s.path.length < config.maxPathPoints) s.path.push([e.clientX, e.clientY]);
    });
    ctx.on(doc, 'mouseover', (e) => e.target && s.hovered.add(e.target));
    ctx.on(doc, 'pointerdown', (e) => {
      s.pointerType = e.pointerType || 'mouse';
    });
    ctx.on(doc, 'click', (e) => {
      const path = s.path;
      s.path = [];
      if (e.detail === 0 || s.pointerType !== 'mouse') return;

      const flags = [];
      if (path.length <= config.maxTeleportMoves) flags.push('teleport');
      if (!s.hovered.has(e.target)) flags.push('no-hover');
      if (hitsExactCentre(e, config.centreTolerancePx)) flags.push('exact-centre');
      if (isStraight(path, config)) flags.push('straight-path');
      if (Number.isInteger(e.clientX) && Number.isInteger(e.clientY) && path.length && path.every(([x, y]) => Number.isInteger(x) && Number.isInteger(y))) {
        flags.push('integer-coords');
      }

      s.clicks++;
      for (const flag of flags) s.flagCounts[flag] = (s.flagCounts[flag] ?? 0) + 1;
      // integer-coords alone is common for real mice in Chrome; it only counts alongside stronger flags.
      const strong = flags.filter((f) => f !== 'integer-coords');
      const clickIsRobotic = strong.length >= 2 || (strong.includes('exact-centre') && strong.includes('teleport'));
      if (clickIsRobotic) s.flagged++;
      ctx.log('click', { flags, moves: path.length, target: ctx.describe(e.target) });

      const evidence = { clicks: s.clicks, roboticClicks: s.flagged, flagCounts: s.flagCounts };
      if (s.clicks >= config.minClicks && s.flagged / s.clicks >= config.detectRatio) ctx.escalate({ status: 'detected', evidence });
      else if (s.flagged) ctx.escalate({ status: 'suspicious', evidence });
      else ctx.escalate({ status: 'clean', evidence });
    });
    ctx.report({ status: 'clean', evidence: { clicks: 0 } });
  },
};

function hitsExactCentre(event, tolerance) {
  const rect = event.target?.getBoundingClientRect?.();
  if (!rect || !rect.width || !rect.height) return false;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return Math.abs(event.clientX - cx) <= tolerance && Math.abs(event.clientY - cy) <= tolerance;
}

/** True when every recorded point lies within tolerance of the start→end line. */
function isStraight(path, { straightTolerancePx, minPathLengthPx }) {
  if (path.length < 3) return false;
  const [x1, y1] = path[0];
  const [x2, y2] = path[path.length - 1];
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length < minPathLengthPx) return false;
  return path.every(([x, y]) => Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / length <= straightTolerancePx);
}
