/**
 * Tells the server when this session's score rises to a new level, so the
 * server can apply its own policy (rate-limit sensitive endpoints, require
 * step-up, alert someone). Changes nothing on the page.
 */
const LEVEL_RANK = { clean: 0, suspicious: 1, 'likely-agent': 2 };

export default {
  id: 'responder.notify-server',
  kind: 'responder',
  version: '0.1.0',
  title: 'Notify server',
  description: 'POSTs { sessionId, level, score, contributors } to the server each time the score reaches a higher level. Never alters the page.',
  tags: ['server', 'flag'],
  defaults: { endpoint: '/api/flag', minLevel: 'suspicious' },

  start(ctx) {
    ctx.state.sentRank = -1;
    ctx.state.ready = true;
  },

  onScore(result, ctx) {
    const { state, config, window: win } = ctx;
    if (!state.ready || typeof win.fetch !== 'function') return;
    const rank = LEVEL_RANK[result.level] ?? 0;
    if (rank < LEVEL_RANK[config.minLevel] || rank <= state.sentRank) return;
    state.sentRank = rank;
    const body = {
      sessionId: ctx.sessionId,
      reason: `score-${result.level}`,
      level: result.level,
      score: result.score,
      contributors: result.contributors.map((c) => c.id),
    };
    win
      .fetch(config.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), keepalive: true })
      .then((res) => ctx.log('flag-sent', { level: result.level, score: result.score, status: res.status }))
      .catch((error) => ctx.log('flag-failed', { message: String(error?.message ?? error) }));
  },
};
