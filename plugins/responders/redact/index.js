/**
 * Hides sensitive values until a person reveals them, one field at a time.
 *
 * Values are removed from the DOM (kept only in this plugin's memory), so
 * agents reading the DOM, the accessibility tree or the page text get the mask,
 * not the data. A trusted click or Enter/Space on a field reveals it for a
 * while, then it hides again. With `requireStepUp`, each reveal also needs
 * WebAuthn user verification through the "step-up" service.
 *
 * Opt-in (ADR 0005). Without step-up, a CDP-driven agent can still click to
 * reveal fields — one at a time, each one logged — so pair it with step-up on
 * the most sensitive pages.
 */
export default {
  id: 'responder.redact',
  kind: 'responder',
  version: '0.1.0',
  title: 'Redact sensitive values',
  description: 'Removes the text of sensitive fields from the DOM (always, or once the score crosses a threshold) and reveals one field at a time on a trusted click or key press, optionally behind step-up.',
  tags: ['redaction', 'friction', 'privacy'],
  defaults: {
    enabled: false,
    selector: '[data-as-sensitive]',
    fieldSelector: 'td',
    mode: 'on-score', // 'on-score' | 'always'
    threshold: 40,
    mask: '••••••',
    revealMs: 15000,
    requireStepUp: false,
  },

  start(ctx) {
    const { document: doc, natives, config } = ctx;
    const s = ctx.state;
    s.originals = new Map();
    s.timers = new Map();
    s.active = false;
    // Find fields without querySelectorAll on sensitive content, which detector.sensitive-reads observes.
    s.roots = natives.querySelectorAll ? Array.from(natives.querySelectorAll.call(doc, config.selector)) : [];
    s.fields = s.roots.flatMap((root) => elementsMatching(doc, root, config.fieldSelector));

    s.maskAll = (why) => {
      if (s.active) return;
      s.active = true;
      for (const field of s.fields) mask(field, s, config);
      ctx.log('redacted', { why, fields: s.fields.length });
    };

    const onActivate = async (event) => {
      if (event.type === 'keydown' && event.key !== 'Enter' && event.key !== ' ') return;
      const field = event.target?.closest?.('[data-as-masked]');
      if (!field || !s.originals.has(field)) return;
      event.preventDefault();
      if (!event.isTrusted) return ctx.log('reveal-refused', { why: 'untrusted event', field: ctx.describe(field) });
      if (config.requireStepUp) {
        const stepUp = ctx.service('step-up');
        if (!stepUp) return ctx.log('reveal-refused', { why: 'step-up required but responder.step-up is not enabled' });
        const { verified, reason } = await stepUp('reveal');
        if (!verified) return ctx.log('reveal-refused', { why: 'step-up failed', reason });
      }
      unmask(field, s);
      ctx.log('revealed', { field: ctx.describe(field), forMs: config.revealMs });
      natives.clearTimeout(s.timers.get(field));
      s.timers.set(field, natives.setTimeout(() => s.active && mask(field, s, config), config.revealMs));
    };
    for (const root of s.roots) {
      ctx.on(root, 'click', onActivate, { capture: true, passive: false });
      ctx.on(root, 'keydown', onActivate, { capture: true, passive: false });
    }
    ctx.onCleanup(() => {
      for (const timer of s.timers.values()) natives.clearTimeout(timer);
      for (const field of [...s.originals.keys()]) unmask(field, s);
    });

    s.ready = true;
    if (config.mode === 'always') s.maskAll('mode: always');
  },

  onScore(result, ctx) {
    const s = ctx.state;
    if (!s.ready || ctx.config.mode !== 'on-score' || result.score < ctx.config.threshold) return;
    s.maskAll(`score ${result.score} ≥ ${ctx.config.threshold}`);
  },
};

function elementsMatching(doc, root, selector) {
  const out = [];
  const walker = doc.createTreeWalker(root, 1 /* NodeFilter.SHOW_ELEMENT */);
  for (let el = walker.nextNode(); el; el = walker.nextNode()) if (el.matches(selector)) out.push(el);
  return out;
}

function textNodes(field) {
  const nodes = [];
  const walker = field.ownerDocument.createTreeWalker(field, 4 /* NodeFilter.SHOW_TEXT */);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
  return nodes;
}

function mask(field, s, config) {
  if (!s.originals.has(field)) {
    const nodes = textNodes(field);
    s.originals.set(field, nodes.map((node) => [node, node.data]));
    nodes.forEach((node, i) => (node.data = i === 0 ? config.mask : ''));
  }
  field.setAttribute('data-as-masked', '');
  field.setAttribute('tabindex', '0');
  field.setAttribute('role', 'button');
  field.setAttribute('aria-label', 'Hidden value. Press Enter to reveal.');
  field.setAttribute('title', 'Hidden — click to reveal');
}

function unmask(field, s) {
  for (const [node, data] of s.originals.get(field) ?? []) node.data = data;
  s.originals.delete(field);
  for (const name of ['data-as-masked', 'tabindex', 'role', 'aria-label', 'title']) field.removeAttribute(name);
}
