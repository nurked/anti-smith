/**
 * CDP / inspector attached: console serialization probe.
 *
 * When a Chrome DevTools Protocol client has the Runtime domain enabled
 * (Playwright, Puppeteer, Selenium 4, chrome.debugger-based extensions, or
 * DevTools itself), console arguments are serialised for the client. Getters
 * on the logged objects can fire during that serialisation. We log an Error
 * with a `stack` getter and a detached element with an `id` getter and see
 * whether either getter runs.
 *
 * NOISY: DevTools being open triggers it too, and V8 changes have broken the
 * Error.stack variant in recent Chrome versions. Treat results as data to
 * compare across runs, not as a verdict.
 */
export default {
  id: 'detector.cdp-console',
  kind: 'detector',
  version: '0.1.0',
  title: 'CDP attached (console serialization)',
  description: 'Logs objects with getters via console.debug; if a getter fires without DevTools visibly docked, a protocol client is probably attached.',
  weight: 'medium',
  noisy: true,
  phase: 'runtime',
  tags: ['cdp', 'debugger', 'noisy'],
  limitations: [
    'Fires for humans with DevTools open; undocked DevTools cannot be told apart from automation.',
    'Recent V8 reads Error.stack internally without calling user getters, which silences the classic variant (reported by Castle, 2025).',
    'Frameworks that avoid Runtime.enable, and WebDriver BiDi sessions, do not trigger it.',
  ],
  defaults: { intervalMs: 5000, devtoolsGapPx: 160 },

  start(ctx) {
    const { window: win, document: doc, natives, config } = ctx;
    const s = ctx.state;
    s.last = null;
    s.probes = 0;
    s.hits = 0;

    const probe = () => {
      const fired = new Set();
      const error = new Error('anti-smith CDP probe');
      natives.defineProperty(error, 'stack', {
        configurable: true,
        get() {
          fired.add('error.stack');
          return 'anti-smith-probe';
        },
      });
      natives.consoleDebug(error);
      if (doc?.createElement) {
        const element = doc.createElement('div');
        natives.defineProperty(element, 'id', {
          configurable: true,
          get() {
            fired.add('element.id');
            return 'anti-smith-probe';
          },
        });
        natives.consoleDebug(element);
      }

      s.probes++;
      const widthGap = (win.outerWidth ?? 0) - (win.innerWidth ?? 0);
      const heightGap = (win.outerHeight ?? 0) - (win.innerHeight ?? 0);
      const devtoolsDocked = widthGap > config.devtoolsGapPx || heightGap > config.devtoolsGapPx + 80;
      const getters = [...fired];
      if (getters.length) s.hits++;

      const key = `${getters.join(',')}|${devtoolsDocked}`;
      if (key !== s.last) {
        s.last = key;
        ctx.log('probe', { getters, devtoolsDocked, widthGap, heightGap });
      }
      const evidence = { getters, devtoolsDocked, probes: s.probes, hits: s.hits };
      if (!getters.length) {
        if (ctx.finding()?.status === 'pending') ctx.report({ status: 'clean', evidence });
        return;
      }
      ctx.escalate({
        status: devtoolsDocked ? 'suspicious' : 'detected',
        evidence: { ...evidence, note: devtoolsDocked ? 'DevTools appears docked — likely a human with DevTools' : undefined },
      });
    };

    probe();
    ctx.every(config.intervalMs, probe);
  },
};
