/**
 * When actions happen, not how.
 *
 * - Time from navigation to first interaction (scripts act within milliseconds).
 * - Regularity of the gaps between actions.
 * - "Stop and go": LLM agents pause for seconds while the model thinks, with no
 *   mouse movement at all, then act instantly. People move the mouse while
 *   reading and on the way to a target.
 */
export default {
  id: 'detector.interaction-timing',
  kind: 'detector',
  version: '0.1.0',
  title: 'Interaction timing',
  description: 'Time to first interaction, regularity of action gaps, and long motionless pauses followed by instant actions.',
  weight: 'weak',
  phase: 'runtime',
  tags: ['behaviour', 'timing', 'llm'],
  limitations: [
    'Keyboard-only users and people who read without touching the mouse look like stop-and-go.',
    'Timing alone is easy to randomise; it is a supporting signal only.',
  ],
  defaults: { fastFirstMs: 500, thinkGapMs: 2000, maxMovesInGap: 2, minActions: 5, regularCv: 0.2, stopAndGoRatio: 0.6 },

  start(ctx) {
    const { document: doc, config } = ctx;
    if (!doc) return ctx.report({ status: 'unsupported', evidence: { reason: 'no document' } });
    const s = ctx.state;
    s.first = null;
    s.lastActionAt = null;
    s.lastKeyAt = -Infinity;
    s.movesSinceAction = 0;
    s.gaps = [];
    s.actions = 0;
    s.stopAndGo = 0;

    const onAction = (kind, e) => {
      const at = e.timeStamp;
      s.actions++;
      if (!s.first) {
        s.first = { kind, atMs: Math.round(at) };
        ctx.log('first-interaction', s.first);
      }
      if (s.lastActionAt !== null) {
        const gap = at - s.lastActionAt;
        s.gaps.push(gap);
        if (gap >= config.thinkGapMs && s.movesSinceAction <= config.maxMovesInGap) {
          s.stopAndGo++;
          ctx.log('stop-and-go', { kind, gapMs: Math.round(gap), movesInGap: s.movesSinceAction });
        }
      }
      s.lastActionAt = at;
      s.movesSinceAction = 0;
      evaluate();
    };

    const evaluate = () => {
      const flags = [];
      if (s.first && s.first.atMs < config.fastFirstMs) flags.push('fast-first-interaction');
      const recent = s.gaps.slice(-20);
      let cv = null;
      if (recent.length >= config.minActions) {
        const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
        const sd = Math.sqrt(recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length);
        cv = mean ? Math.round((sd / mean) * 1000) / 1000 : 0;
        if (cv < config.regularCv) flags.push('regular-gaps');
      }
      if (s.actions >= config.minActions && s.stopAndGo / (s.actions - 1) >= config.stopAndGoRatio) flags.push('stop-and-go');
      const evidence = { flags, actions: s.actions, firstInteraction: s.first, gapCv: cv, stopAndGo: s.stopAndGo };
      ctx.escalate({ status: flags.length ? 'suspicious' : 'clean', evidence });
    };

    ctx.on(doc, 'mousemove', () => s.movesSinceAction++);
    ctx.on(doc, 'pointerdown', (e) => onAction('pointerdown', e));
    ctx.on(doc, 'keydown', (e) => {
      // Only the first key of a typing burst counts as an action.
      if (e.timeStamp - s.lastKeyAt > 1000) onAction('keydown', e);
      s.lastKeyAt = e.timeStamp;
    });
    ctx.on(doc, 'submit', (e) => onAction('submit', e));
    ctx.report({ status: 'clean', evidence: { actions: 0 } });
  },
};
