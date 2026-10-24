/**
 * Focus, scroll and window-state patterns.
 *
 * - Focus that moves with no pointer or key press just before it (element.focus()).
 * - Scrolling with no wheel, touch, key or pointer activity (scrollIntoView before a CDP click).
 * - Clicks or key presses while the document is hidden or unfocused. A person
 *   cannot click a hidden tab; an agent driving a background tab can.
 */
export default {
  id: 'detector.focus-scroll',
  kind: 'detector',
  version: '0.1.0',
  title: 'Focus, scroll and hidden-tab input',
  description: 'Programmatic focus, unexplained scrolling, and input delivered while the page is hidden or unfocused.',
  weight: 'medium',
  phase: 'runtime',
  tags: ['behaviour', 'focus', 'scroll'],
  limitations: [
    'Autofocus, anchor links, find-in-page, scrollbar drags and smooth-scroll tails cause some unexplained focus/scroll.',
    'An agent that keeps the tab focused and visible (most do while acting) passes the hidden-input check.',
    'document.hasFocus and visibilityState are captured at start; patches applied before load can still lie.',
  ],
  defaults: { focusWindowMs: 400, scrollWindowMs: 1000, ignoreBeforeMs: 1500, minProgrammatic: 3, unfocusedDetect: 3 },

  start(ctx) {
    const { window: win, document: doc, config } = ctx;
    if (!doc) return ctx.report({ status: 'unsupported', evidence: { reason: 'no document' } });
    const hasFocus = win.Document?.prototype?.hasFocus;
    const visibility = Object.getOwnPropertyDescriptor(win.Document?.prototype ?? {}, 'visibilityState')?.get;
    const isFocused = () => (hasFocus ? hasFocus.call(doc) : true);
    const state = () => (visibility ? visibility.call(doc) : 'visible');

    const s = ctx.state;
    s.lastPointer = -Infinity;
    s.lastKey = -Infinity;
    s.lastWheel = -Infinity;
    s.lastScrollLog = -Infinity;
    s.counts = { programmaticFocus: 0, unexplainedScroll: 0, unfocusedInput: 0, hiddenInput: 0 };

    const evaluate = () => {
      const c = s.counts;
      const evidence = { counts: c };
      if (c.hiddenInput) return ctx.escalate({ status: 'detected', weight: 'strong', evidence });
      if (c.unfocusedInput >= config.unfocusedDetect) return ctx.escalate({ status: 'detected', evidence });
      if (c.unfocusedInput || c.programmaticFocus >= config.minProgrammatic || c.unexplainedScroll >= config.minProgrammatic) {
        return ctx.escalate({ status: 'suspicious', evidence });
      }
      ctx.escalate({ status: 'clean', evidence });
    };

    const onUserInput = (e) => {
      if (!e.isTrusted) return; // detector.input-trust covers synthetic events
      if (state() === 'hidden') {
        s.counts.hiddenInput++;
        ctx.log('input-while-hidden', { type: e.type, target: ctx.describe(e.target) });
      } else if (!isFocused()) {
        s.counts.unfocusedInput++;
        ctx.log('input-while-unfocused', { type: e.type, target: ctx.describe(e.target) });
      }
      evaluate();
    };

    ctx.on(doc, 'pointerdown', (e) => (s.lastPointer = e.timeStamp));
    ctx.on(doc, 'mousedown', (e) => (s.lastPointer = e.timeStamp));
    ctx.on(doc, 'keydown', (e) => {
      s.lastKey = e.timeStamp;
      onUserInput(e);
    });
    ctx.on(doc, 'click', onUserInput);
    ctx.on(win, 'wheel', (e) => (s.lastWheel = e.timeStamp));
    ctx.on(win, 'touchmove', (e) => (s.lastWheel = e.timeStamp));

    ctx.on(doc, 'focusin', (e) => {
      if (e.timeStamp < config.ignoreBeforeMs) return;
      const gap = e.timeStamp - Math.max(s.lastPointer, s.lastKey);
      if (gap > config.focusWindowMs) {
        s.counts.programmaticFocus++;
        ctx.log('programmatic-focus', { gapMs: Number.isFinite(gap) ? Math.round(gap) : null, target: ctx.describe(e.target) });
        evaluate();
      }
    });

    // Scroll does not bubble, but a capturing listener on document sees element scrolls too.
    ctx.on(doc, 'scroll', (e) => {
      const gap = e.timeStamp - Math.max(s.lastWheel, s.lastKey, s.lastPointer);
      if (gap <= config.scrollWindowMs || e.timeStamp - s.lastScrollLog < 500) return;
      s.lastScrollLog = e.timeStamp;
      s.counts.unexplainedScroll++;
      ctx.log('unexplained-scroll', { gapMs: Number.isFinite(gap) ? Math.round(gap) : null, target: ctx.describe(e.target === doc ? doc.documentElement : e.target) });
      evaluate();
    });

    ctx.on(win, 'blur', () => ctx.log('window-blur', { visibility: state() }));
    ctx.on(win, 'focus', () => ctx.log('window-focus', { visibility: state() }));
    ctx.report({ status: 'clean', evidence: { counts: s.counts } });
  },
};
