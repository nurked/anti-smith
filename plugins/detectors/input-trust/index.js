/**
 * Event.isTrusted on every user-facing event.
 *
 * Events dispatched by script (element.click(), dispatchEvent) — including from
 * extension content scripts — arrive with isTrusted === false. Input sent
 * through CDP (Input.dispatchMouseEvent / dispatchKeyEvent) is trusted, so a
 * clean result here says nothing about CDP-driven agents.
 */
export default {
  id: 'detector.input-trust',
  kind: 'detector',
  version: '0.1.0',
  title: 'Untrusted (synthetic) events',
  description: 'Records isTrusted for clicks, keys, input, focus, submit and pointer events; any untrusted user event is a script pretending to be a user.',
  weight: 'strong',
  phase: 'runtime',
  tags: ['behaviour', 'events'],
  limitations: [
    'CDP input (Playwright, Puppeteer, chrome.debugger extensions) produces trusted events and passes.',
    'The page’s own code may dispatch synthetic events (some UI libraries do); list those types in ignoreTypes.',
    'Never logs key values or typed text — only event types and targets.',
  ],
  defaults: {
    types: ['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'keydown', 'keyup', 'input', 'change', 'submit', 'focusin', 'contextmenu', 'touchstart'],
    ignoreTypes: [],
    maxLogged: 500,
  },

  start(ctx) {
    const { document: doc, config } = ctx;
    if (!doc) return ctx.report({ status: 'unsupported', evidence: { reason: 'no document' } });
    const s = ctx.state;
    s.trusted = 0;
    s.untrusted = 0;
    s.byType = {};
    s.logged = 0;
    s.examples = [];

    const onEvent = (event) => {
      if (config.ignoreTypes.includes(event.type)) return;
      const trusted = event.isTrusted === true;
      trusted ? s.trusted++ : s.untrusted++;
      const bucket = (s.byType[event.type] ??= { trusted: 0, untrusted: 0 });
      trusted ? bucket.trusted++ : bucket.untrusted++;
      if (s.logged++ < config.maxLogged) ctx.log('event', { type: event.type, isTrusted: trusted, target: ctx.describe(event.target) });

      if (!trusted) {
        if (s.examples.length < 10) s.examples.push({ type: event.type, target: ctx.describe(event.target) });
        ctx.escalate({ status: 'detected', evidence: { trusted: s.trusted, untrusted: s.untrusted, byType: s.byType, examples: s.examples } });
      } else if (ctx.finding()?.status !== 'detected') {
        ctx.report({ status: 'clean', evidence: { trusted: s.trusted, untrusted: 0 } });
      }
    };
    for (const type of config.types) ctx.on(doc, type, onEvent);
    ctx.report({ status: 'clean', evidence: { trusted: 0, untrusted: 0 } });
  },
};
