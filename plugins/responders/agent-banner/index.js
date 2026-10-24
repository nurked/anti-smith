/**
 * Protection level 1 — say it out loud.
 *
 * Shows a banner at the top of the page once the session looks automated:
 * "this page is for people; this session looks like an agent". Changes no
 * content. Readable by people, screen readers and agents alike, so an agent
 * that reports back what it saw will usually pass the message on.
 *
 * Engages when the page's protection level (data-as-protection on <html>, or
 * config.level) is at least `minLevel` and the score reaches `threshold`.
 *
 * Manual trigger: a `protection-trigger` host event (handle.trigger(), e.g. the CRM's
 * test controls) engages it at once, regardless of level and threshold. Only
 * `human-verified` events sent by a protection responder can undo it — never host events.
 */
const NO_RESULT = { score: 0, level: 'clean', contributors: [] };

export default {
  id: 'responder.agent-banner',
  kind: 'responder',
  version: '0.1.0',
  title: 'Agent banner (protection level 1)',
  description: 'Shows a visible notice that this session looks automated and the page is meant for people. Leaves the content alone.',
  tags: ['protection-level', 'notice'],
  defaults: {
    enabled: false,
    minLevel: 1,
    level: null,
    levelAttribute: 'data-as-protection',
    threshold: 40,
    // A page can override the threshold with <html data-as-threshold="N"> (the CRM test site does, via ?threshold=N).
    thresholdAttribute: 'data-as-threshold',
    message: 'This session looks automated. This page is meant to be used by a person, and automated activity here is logged.',
  },

  start(ctx) {
    const s = ctx.state;
    s.ready = true;
    ctx.subscribe((event) => {
      if (event.type === 'human-verified' && fromResponder(event)) {
        s.banner?.remove();
        s.banner = null;
        s.verified = true;
      } else if (triggeredFor(event, ctx)) {
        s.verified = false;
        engage(ctx, s.lastResult ?? NO_RESULT, 'manual trigger');
      }
    });
    ctx.onCleanup(() => s.banner?.remove());
  },

  onScore(result, ctx) {
    const { state: s, config } = ctx;
    s.lastResult = result;
    if (!s.ready || s.verified) return;
    if (pageLevel(ctx) < config.minLevel || result.score < threshold(ctx)) return;
    engage(ctx, result, 'score');
  },
};

function engage(ctx, result, why) {
  const { state: s, config, document: doc } = ctx;
  if (!s.ready || s.banner || !doc?.body) return;
  const banner = doc.createElement('div');
  banner.setAttribute('role', 'status');
  banner.setAttribute('data-as-banner', '');
  banner.setAttribute(
    'style',
    'position:sticky;top:0;z-index:2147483646;display:flex;gap:12px;align-items:center;padding:10px 16px;' +
      'background:#7a1f1f;color:#fff;font:600 14px/1.4 system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.25)',
  );
  const text = doc.createElement('span');
  text.textContent = config.message;
  const detail = doc.createElement('span');
  detail.setAttribute('style', 'font-weight:400;opacity:.85');
  detail.textContent =
    why === 'manual trigger'
      ? '(triggered manually)'
      : `(score ${result.score}: ${result.contributors.map((c) => c.id.replace(/^detector\./, '')).join(', ')})`;
  banner.append(text, detail);
  ctx.own(banner);
  doc.body.prepend(banner);
  s.banner = banner;
  ctx.log('shown', { why, score: result.score, level: pageLevel(ctx) });
}

/** Host events may trigger protection; only a responder (after step-up) may announce human-verified. */
function fromResponder(event) {
  return typeof event.source === 'string' && event.source.startsWith('responder.');
}

function triggeredFor(event, ctx) {
  return event.type === 'protection-trigger' && (event.data?.responder ?? ctx.id) === ctx.id;
}

function threshold(ctx) {
  const fromPage = Number(ctx.document?.documentElement?.getAttribute(ctx.config.thresholdAttribute));
  return Number.isFinite(fromPage) && fromPage > 0 ? fromPage : ctx.config.threshold;
}

function pageLevel(ctx) {
  if (ctx.config.level != null) return Number(ctx.config.level);
  return Number(ctx.document?.documentElement?.getAttribute(ctx.config.levelAttribute) ?? 0) || 0;
}
