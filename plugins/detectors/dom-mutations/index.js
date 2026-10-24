/**
 * DOM changes the page did not make.
 *
 * Extension agents usually leave something in the DOM: an overlay, a cursor
 * highlight, a shadow-root host, injected styles or marker attributes. This
 * detector watches the whole document and records nodes that are neither
 * claimed by the page (see core/ownership.js) nor inside an ignored subtree.
 */
export default {
  id: 'detector.dom-mutations',
  kind: 'detector',
  version: '0.1.0',
  title: 'Foreign DOM changes',
  description: 'MutationObserver over the whole document: injected nodes, scripts, styles, iframes, shadow roots and suspicious attributes the page did not create.',
  weight: 'medium',
  phase: 'runtime',
  tags: ['dom', 'extension', 'overlay'],
  lists: { attributePatterns: 'dom-attribute-patterns' },
  limitations: [
    'Many ordinary extensions (password managers, Grammarly, translators, ad blockers) inject DOM too, so this tops out at suspicious.',
    'Closed shadow roots and shadow roots attached from an isolated world are not visible; only main-world attachShadow calls are observed.',
    'Pages that build DOM at runtime must claim their nodes (runtime.claim) or mark containers with data-as-ignore, or they will flag themselves.',
  ],
  defaults: {
    maxLogged: 200,
    snippetChars: 240,
    riskyTags: ['script', 'style', 'link', 'iframe', 'object', 'embed', 'canvas'],
    attributePatterns: ['^data-(?:pw|playwright|agent|ref|claude|browser-use|highlight)', '^__', '^cdp'],
  },

  start(ctx) {
    const { window: win, document: doc, config } = ctx;
    if (!doc?.documentElement || typeof win.MutationObserver !== 'function') {
      return ctx.report({ status: 'unsupported', evidence: { reason: 'MutationObserver unavailable' } });
    }
    const s = ctx.state;
    s.counts = { nodes: 0, risky: 0, shadowRoots: 0, attributes: 0 };
    s.logged = 0;
    s.seen = new WeakSet();
    s.examples = [];
    const attributePatterns = config.attributePatterns.map((source) => new RegExp(source, 'i'));

    const note = (kind, detail) => {
      if (s.examples.length < 10) s.examples.push({ kind, ...detail });
      if (s.logged++ < config.maxLogged) ctx.log(kind, detail);
      ctx.escalate({ status: 'suspicious', evidence: { counts: s.counts, examples: s.examples } });
    };

    const observer = new win.MutationObserver((records) => {
      for (const record of records) {
        if (ctx.isIgnored(record.target)) continue;
        if (record.type === 'childList') {
          for (const node of record.addedNodes) {
            if (ctx.isOwned(node) || ctx.isIgnored(node) || s.seen.has(node)) continue;
            if (node.nodeType === 3 && !String(node.data).trim()) continue;
            s.seen.add(node);
            s.counts.nodes++;
            const tag = node.nodeType === 1 ? node.tagName.toLowerCase() : '#text';
            const risky = config.riskyTags.includes(tag) || tag.includes('-') || Boolean(node.shadowRoot);
            if (risky) s.counts.risky++;
            if (node.shadowRoot) s.counts.shadowRoots++;
            note(risky ? 'foreign-risky-node' : 'foreign-node', {
              parent: ctx.describe(record.target),
              node: ctx.describe(node, { snippet: node.nodeType === 1, snippetChars: config.snippetChars }),
              openShadowRoot: Boolean(node.shadowRoot),
            });
          }
        } else if (record.type === 'attributes') {
          const name = record.attributeName ?? '';
          if (!attributePatterns.some((re) => re.test(name))) continue;
          s.counts.attributes++;
          note('foreign-attribute', {
            on: ctx.describe(record.target),
            name,
            value: String(record.target.getAttribute?.(name) ?? '').slice(0, 120),
          });
        }
      }
    });
    observer.observe(doc.documentElement, { childList: true, subtree: true, attributes: true });

    // Main-world shadow roots on page elements (extensions in an isolated world bypass this).
    if (win.Element?.prototype) {
      ctx.observeCall(win.Element.prototype, 'attachShadow', ({ thisArg, args }) => {
        if (ctx.isIgnored(thisArg)) return;
        s.counts.shadowRoots++;
        note('attach-shadow', { host: ctx.describe(thisArg, { snippet: !ctx.isOwned(thisArg) }), mode: args[0]?.mode ?? null });
      });
    }

    ctx.report({ status: 'clean', evidence: { counts: s.counts } });
    return () => observer.disconnect();
  },
};
