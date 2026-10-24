/**
 * Ships events to the lab server in batches: POST { sessionId, events } to
 * `endpoint`. On page hide it flushes with navigator.sendBeacon. If the server
 * is not there, it gives up quietly after a few failures (the in-memory log
 * and JSON export still work).
 */
export default {
  id: 'sink.http-log',
  kind: 'sink',
  version: '0.1.0',
  title: 'HTTP log sink',
  description: 'Batches events to POST /log, using sendBeacon on page hide.',
  tags: ['logging'],
  defaults: { endpoint: '/log', batchSize: 50, flushMs: 2000, maxFailures: 3 },

  start(ctx) {
    const { window: win, document: doc, config } = ctx;
    const s = ctx.state;
    s.queue = s.queue ?? [];
    s.failures = 0;
    s.disabled = typeof win.fetch !== 'function';

    const body = (events) => JSON.stringify({ sessionId: ctx.sessionId, events });
    s.flush = () => {
      if (s.disabled || !s.queue.length) return;
      const events = s.queue.splice(0, s.queue.length);
      win
        .fetch(config.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body(events), keepalive: true })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          s.failures = 0;
        })
        .catch(() => {
          if (++s.failures >= config.maxFailures) s.disabled = true;
        });
    };
    const beacon = () => {
      if (s.disabled || !s.queue.length || typeof win.navigator?.sendBeacon !== 'function') return s.flush();
      const events = s.queue.splice(0, s.queue.length);
      win.navigator.sendBeacon(config.endpoint, new win.Blob([body(events)], { type: 'application/json' }));
    };

    ctx.every(config.flushMs, s.flush);
    ctx.on(win, 'pagehide', beacon);
    ctx.on(doc, 'visibilitychange', () => doc.visibilityState === 'hidden' && beacon());
    return beacon;
  },

  onEvent(event, ctx) {
    const s = ctx.state;
    (s.queue ??= []).push(event);
    if (s.queue.length >= ctx.config.batchSize) s.flush?.();
  },
};
