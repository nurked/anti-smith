/**
 * Scroll-into-view immediately followed by a click.
 *
 * Automation clicks an element by reference: it scrolls the element into view
 * (Playwright scrollIntoViewIfNeeded, CDP DOM.scrollIntoViewIfNeeded) and then
 * clicks within milliseconds. People scroll with a wheel, trackpad, keys or
 * scrollbar, and need a few hundred milliseconds to aim after the page moves.
 * Observed with Claude in Chrome on 2026-10-24: unexplained scroll, click 60 ms later.
 */
export default {
  id: 'detector.scroll-then-click',
  kind: 'detector',
  version: '0.1.0',
  title: 'Scroll-into-view then click',
  description: 'A scroll with no wheel, touch, key or pointer input behind it, followed by a click within a few hundred milliseconds.',
  weight: 'weak',
  evidence: 'behaviour',
  phase: 'runtime',
  tags: ['behaviour', 'scroll', 'cdp'],
  limitations: [
    'Only fires when the target was off-screen; agents clicking visible elements never scroll.',
    'Anchor links, find-in-page and focus-driven scrolling followed by a very fast click could match; the window is kept short to limit this.',
    'Scrollbar drags send no wheel event; a pointerdown on the scrollbar counts as an explanation, which most browsers provide.',
  ],
  defaults: { explainedWithinMs: 1000, clickWithinMs: 300, detectAfter: 3 },

  start(ctx) {
    const { window: win, document: doc, config } = ctx;
    if (!doc) return ctx.report({ status: 'unsupported', evidence: { reason: 'no document' } });
    const s = ctx.state;
    s.lastInput = -Infinity;
    s.lastUnexplainedScroll = null;
    s.pairs = 0;
    s.clicks = 0;

    const explain = (e) => (s.lastInput = e.timeStamp);
    for (const type of ['wheel', 'touchmove', 'keydown', 'pointerdown', 'mousedown']) ctx.on(win, type, explain);

    ctx.on(doc, 'scroll', (e) => {
      if (e.timeStamp - s.lastInput > config.explainedWithinMs) s.lastUnexplainedScroll = e.timeStamp;
    });

    ctx.on(doc, 'click', (e) => {
      s.clicks++;
      const since = s.lastUnexplainedScroll === null ? null : e.timeStamp - s.lastUnexplainedScroll;
      if (since === null || since > config.clickWithinMs) return;
      s.lastUnexplainedScroll = null;
      s.pairs++;
      ctx.log('scroll-then-click', { clickAfterMs: Math.round(since), target: ctx.describe(e.target) });
      const evidence = { pairs: s.pairs, clicks: s.clicks, lastClickAfterMs: Math.round(since) };
      ctx.escalate({ status: s.pairs >= config.detectAfter ? 'detected' : 'suspicious', evidence });
    });

    ctx.report({ status: 'clean', evidence: { pairs: 0 } });
  },
};
