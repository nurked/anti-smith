/**
 * Hints that something is capturing or emulating the page.
 *
 * - Viewport-only resizes (inner size changes, outer window does not, zoom
 *   unchanged): CDP Emulation.setDeviceMetricsOverride, used for full-page
 *   screenshots and by agents that fix a viewport.
 * - Animation-frame stalls while the page is visible, near actions: screenshot
 *   capture can stall the compositor.
 * - Visibility flips around activity.
 */
export default {
  id: 'detector.capture-hints',
  kind: 'detector',
  version: '0.1.0',
  title: 'Screenshot / emulation hints',
  description: 'Viewport-only resizes, requestAnimationFrame stalls near actions, and visibility changes during activity.',
  weight: 'weak',
  evidence: 'environment',
  noisy: true,
  phase: 'runtime',
  tags: ['screenshot', 'cdp', 'noisy'],
  limitations: [
    'DevTools device emulation also changes only the viewport; busy main threads also stall frames.',
    'Screenshots taken by the OS or by a computer-use agent watching the screen leave no trace in the page.',
    'Unverified hypothesis: whether Page.captureScreenshot stalls frames measurably varies by Chrome version — see docs/test-plan.md.',
  ],
  defaults: { stallMs: 250, nearActionMs: 2000, minStalls: 3, maxLogged: 100 },

  start(ctx) {
    const { window: win, document: doc, natives, config } = ctx;
    if (!doc) return ctx.report({ status: 'unsupported', evidence: { reason: 'no document' } });
    const s = ctx.state;
    s.counts = { viewportOnlyResizes: 0, stallsNearActions: 0, stalls: 0, hiddenDuringActivity: 0 };
    s.lastAction = -Infinity;
    s.logged = 0;
    s.size = sizes(win);
    s.lastFrame = null;

    const log = (type, data) => {
      if (s.logged++ < config.maxLogged) ctx.log(type, data);
    };
    const evaluate = () => {
      const c = s.counts;
      const suspicious = c.viewportOnlyResizes > 0 || c.stallsNearActions >= config.minStalls || c.hiddenDuringActivity > 0;
      ctx.escalate({ status: suspicious ? 'suspicious' : 'clean', evidence: { counts: c } });
    };
    const markAction = (e) => (s.lastAction = e.timeStamp);
    ctx.on(doc, 'pointerdown', markAction);
    ctx.on(doc, 'keydown', markAction);

    ctx.on(win, 'resize', () => {
      const next = sizes(win);
      const prev = s.size;
      s.size = next;
      const innerChanged = next.inner[0] !== prev.inner[0] || next.inner[1] !== prev.inner[1];
      const outerChanged = next.outer[0] !== prev.outer[0] || next.outer[1] !== prev.outer[1];
      const zoomChanged = next.dpr !== prev.dpr;
      const viewportOnly = innerChanged && !outerChanged && !zoomChanged;
      if (viewportOnly) s.counts.viewportOnlyResizes++;
      log('resize', { from: prev, to: next, viewportOnly });
      evaluate();
    });

    ctx.on(doc, 'visibilitychange', (e) => {
      const nearAction = e.timeStamp - s.lastAction < config.nearActionMs;
      if (doc.visibilityState === 'hidden' && nearAction) s.counts.hiddenDuringActivity++;
      s.lastFrame = null;
      log('visibility', { state: doc.visibilityState, nearAction });
      evaluate();
    });

    if (natives.requestAnimationFrame) {
      let handle;
      const frame = (t) => {
        if (s.lastFrame !== null && doc.visibilityState === 'visible') {
          const gap = t - s.lastFrame;
          if (gap > config.stallMs) {
            s.counts.stalls++;
            const nearAction = t - s.lastAction < config.nearActionMs;
            if (nearAction) s.counts.stallsNearActions++;
            log('frame-stall', { gapMs: Math.round(gap), nearAction });
            if (nearAction) evaluate();
          }
        }
        s.lastFrame = t;
        handle = natives.requestAnimationFrame(frame);
      };
      handle = natives.requestAnimationFrame(frame);
      ctx.onCleanup(() => natives.cancelAnimationFrame?.(handle));
    }

    ctx.report({ status: 'clean', evidence: { counts: s.counts, initialSize: s.size } });
  },
};

function sizes(win) {
  return { inner: [win.innerWidth, win.innerHeight], outer: [win.outerWidth, win.outerHeight], dpr: win.devicePixelRatio };
}
