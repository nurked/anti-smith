/**
 * The onDetected(score) hook — a stub.
 *
 * v0 is detect-only: this responder never blocks, hides or changes anything.
 * It logs when the score crosses the threshold and calls `config.onDetected`
 * if the host supplied one. Real responses (redact, step-up auth, notify the
 * server, block) belong in their own responder plugins — see docs/roadmap.md.
 */
export default {
  id: 'responder.on-detected',
  kind: 'responder',
  version: '0.1.0',
  title: 'onDetected hook (stub)',
  description: 'Calls config.onDetected(score) once each time the score rises past the threshold. Does not block anything.',
  tags: ['hook', 'stub'],
  defaults: { threshold: 40, onDetected: null },

  start(ctx) {
    ctx.state.above = false;
  },

  onScore(result, ctx) {
    const above = result.score >= ctx.config.threshold;
    if (above && !ctx.state.above) {
      ctx.log('threshold-crossed', { score: result.score, level: result.level, contributors: result.contributors.map((c) => c.id) });
      if (typeof ctx.config.onDetected === 'function') ctx.config.onDetected(result);
    }
    ctx.state.above = above;
  },
};
