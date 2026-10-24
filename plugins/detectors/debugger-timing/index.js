/**
 * `debugger` statement timing. If a debugger is attached with breakpoints
 * active, the statement pauses execution and the elapsed time jumps.
 *
 * WEAK and NOISY: this mostly catches humans with DevTools open, and it will
 * pause their page every interval. Disable with ?skip=detector.debugger-timing.
 */
export default {
  id: 'detector.debugger-timing',
  kind: 'detector',
  version: '0.1.0',
  title: 'Debugger pause timing',
  description: 'Times a debugger statement; a long gap means a debugger with active breakpoints is attached.',
  weight: 'weak',
  evidence: 'environment',
  noisy: true,
  phase: 'runtime',
  tags: ['cdp', 'debugger', 'noisy'],
  limitations: [
    'Automation frameworks rarely enable the Debugger domain, so this mostly measures DevTools users.',
    'Interrupts anyone with DevTools open at every check.',
    'Busy main threads can create false long gaps; the threshold is generous for that reason.',
  ],
  defaults: { initialDelayMs: 1500, intervalMs: 30000, thresholdMs: 100 },

  start(ctx) {
    const { natives, config } = ctx;
    const s = ctx.state;
    s.checks = 0;
    s.paused = 0;

    const check = () => {
      const before = natives.now();
      // eslint-disable-next-line no-debugger
      debugger;
      const pausedMs = Math.round(natives.now() - before);
      s.checks++;
      if (pausedMs > config.thresholdMs) {
        s.paused++;
        ctx.log('paused', { pausedMs });
        ctx.escalate({ status: 'suspicious', evidence: { lastPausedMs: pausedMs, checks: s.checks, paused: s.paused } });
      } else if (ctx.finding()?.status !== 'suspicious') {
        ctx.report({ status: 'clean', evidence: { checks: s.checks, lastMs: pausedMs } });
      }
    };

    ctx.after(config.initialDelayMs, () => {
      check();
      ctx.every(config.intervalMs, check);
    });
  },
};
