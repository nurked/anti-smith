/**
 * Script reads of sensitive content.
 *
 * Observes (never alters) the APIs scrapers use: text getters on sensitive
 * elements and on <body>/<html>, querySelectorAll calls whose results land
 * inside sensitive elements, getSelection, createRange and copy events. The
 * page itself never calls these on sensitive content, so any read is notable.
 * Stack traces reveal who is reading: Puppeteer and Playwright leave
 * recognisable frames, main-world extension scripts show chrome-extension://.
 *
 * MAIN WORLD ONLY: extension content scripts run in an isolated world with
 * their own prototypes, and CDP-based readers (DOM.getDocument,
 * Accessibility.getFullAXTree, screenshots) never touch page JavaScript.
 */
export default {
  id: 'detector.sensitive-reads',
  kind: 'detector',
  version: '0.1.0',
  title: 'Sensitive content reads',
  description: 'Watches main-world reads of elements marked sensitive (innerText/textContent/innerHTML, querySelectorAll, getSelection, createRange, copy).',
  weight: 'medium',
  phase: 'runtime',
  tags: ['scraping', 'dom', 'privacy'],
  lists: { stackMarkers: 'stack-markers' },
  limitations: [
    'Only catches scripts in the page main world. Isolated-world content scripts and CDP DOM/accessibility/screenshot reads are invisible.',
    'Page code (analytics, session replay, rich-text editors) reading the same content will trip it; list known callers in allowStackPatterns.',
    'new Range() via the constructor is not observed, only document.createRange().',
  ],
  defaults: {
    selector: '[data-as-sensitive]',
    watchDocumentRoots: true,
    maxLogPerApi: 25,
    stackMarkers: ['__puppeteer_evaluation_script__', 'pptr:', 'UtilityScript', '__playwright', 'playwright', 'selenium', 'webdriver', 'chrome-extension://', 'moz-extension://'],
    allowStackPatterns: [],
  },

  start(ctx) {
    const { window: win, document: doc, natives, config } = ctx;
    if (!doc?.body) return ctx.report({ status: 'unsupported', evidence: { reason: 'no document body' } });

    const roots = natives.querySelectorAll ? Array.from(natives.querySelectorAll.call(doc, config.selector)) : [];
    const getSelection = natives.getSelection;
    const allow = config.allowStackPatterns.map((source) => new RegExp(source));
    const s = ctx.state;
    s.reads = 0;
    s.byApi = {};
    s.markers = new Set();
    s.extensions = new Set();

    const inSensitive = (node) => roots.some((root) => root === node || root.contains(node));
    const containsSensitive = (node) => roots.some((root) => node === root || node.contains?.(root));

    const record = (api, detail) => {
      const stack = String(new Error().stack ?? '');
      if (allow.some((re) => re.test(stack))) return;
      const marker = config.stackMarkers.find((m) => stack.includes(m)) ?? null;
      const extension = stack.match(/chrome-extension:\/\/([a-p]{32})/)?.[1] ?? null;
      if (marker) s.markers.add(marker);
      if (extension) s.extensions.add(extension);
      s.reads++;
      s.byApi[api] = (s.byApi[api] ?? 0) + 1;
      if (s.byApi[api] <= config.maxLogPerApi) ctx.log('read', { api, ...detail, marker, extension });
      ctx.escalate({
        status: s.markers.size ? 'detected' : 'suspicious',
        evidence: { reads: s.reads, byApi: s.byApi, stackMarkers: [...s.markers], extensionIds: [...s.extensions] },
      });
    };

    // 1. Text getters on sensitive elements, and on the document roots that contain them.
    const watched = [...roots];
    if (config.watchDocumentRoots) watched.push(doc.body, doc.documentElement);
    for (const element of watched) {
      for (const key of ['innerText', 'outerText', 'textContent', 'innerHTML', 'outerHTML']) {
        ctx.observeGetter(element, key, () => record(key, { on: ctx.describe(element) }));
      }
    }

    // 2. Queries whose results include sensitive content.
    const onQuery = (label) => ({ args, result }) => {
      const nodes = Array.from(result ?? []).slice(0, 500);
      if (nodes.some((node) => inSensitive(node) || containsSensitive(node))) {
        record(label, { selector: String(args[0]).slice(0, 120), matches: result.length });
      }
    };
    if (win.Document?.prototype) ctx.observeCall(win.Document.prototype, 'querySelectorAll', onQuery('document.querySelectorAll'));
    if (win.Element?.prototype) ctx.observeCall(win.Element.prototype, 'querySelectorAll', onQuery('element.querySelectorAll'));

    // 3. Selection and range APIs.
    ctx.observeCall(win, 'getSelection', ({ result }) => record('getSelection', { length: String(result ?? '').length }));
    if (win.Document?.prototype) ctx.observeCall(win.Document.prototype, 'createRange', () => record('createRange', {}));

    // 4. Copy events (people copy too; only untrusted copies count as reads).
    ctx.on(doc, 'copy', (e) => {
      const selection = getSelection?.();
      const intersects = Boolean(selection?.rangeCount && roots.some((root) => selection.containsNode(root, true)));
      ctx.log('copy', { isTrusted: e.isTrusted, length: String(selection ?? '').length, intersectsSensitive: intersects });
      if (!e.isTrusted) record('copy-untrusted', { intersectsSensitive: intersects });
    });

    ctx.report({ status: 'clean', evidence: { sensitiveElements: roots.length, selector: config.selector } });
  },
};
