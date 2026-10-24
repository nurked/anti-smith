/**
 * Protection level 2 — turn the content off.
 *
 * Once the session looks automated, the content of every protected region
 * (`[data-as-protected]`, typically <main>) is detached from the document and
 * kept only in memory. Agents reading the DOM, the accessibility tree, the page
 * text or a screenshot get a placeholder. A person gets it back with a trusted
 * click on "verify" plus WebAuthn step-up (responder.step-up); without step-up
 * on the page, there is no way back except reloading as a person.
 */
export default {
  id: 'responder.lockout',
  kind: 'responder',
  version: '0.1.0',
  title: 'Content lockout (protection level 2)',
  description: 'Detaches protected regions from the DOM when the session looks automated; a person restores them through WebAuthn step-up.',
  tags: ['protection-level', 'friction'],
  defaults: {
    enabled: false,
    minLevel: 2,
    level: null,
    levelAttribute: 'data-as-protection',
    threshold: 40,
    // A page can override the threshold with <html data-as-threshold="N"> (the CRM test site does, via ?threshold=N).
    thresholdAttribute: 'data-as-threshold',
    selector: '[data-as-protected]',
    title: 'Content hidden',
    message: 'This content is hidden because this session looks automated. It is meant to be used by a person.',
    verifyLabel: 'I am a person — verify to continue',
    noVerifyMessage: 'Verification is not available on this page. Reload it, or contact support if this keeps happening.',
  },

  start(ctx) {
    const s = ctx.state;
    s.locked = [];
    s.ready = true;
    s.unlock = () => {
      for (const { region, placeholder, content } of s.locked) {
        placeholder.remove();
        region.append(content);
      }
      s.locked = [];
    };
    ctx.subscribe((event) => {
      if (event.type !== 'human-verified') return;
      s.verified = true;
      s.unlock();
    });
    ctx.onCleanup(() => s.unlock());
  },

  onScore(result, ctx) {
    const { state: s, config, document: doc, natives } = ctx;
    if (!s.ready || s.locked.length || s.verified || !doc) return;
    if (pageLevel(ctx) < config.minLevel || result.score < threshold(ctx)) return;

    const regions = natives.querySelectorAll ? Array.from(natives.querySelectorAll.call(doc, config.selector)) : [];
    for (const region of regions) {
      const content = doc.createDocumentFragment();
      while (region.firstChild) content.append(region.firstChild);
      const placeholder = buildPlaceholder(ctx, result);
      region.append(placeholder);
      s.locked.push({ region, placeholder, content });
    }
    ctx.log('locked', { score: result.score, regions: regions.length, level: pageLevel(ctx) });
  },
};

function buildPlaceholder(ctx, result) {
  const { document: doc, config } = ctx;
  const box = doc.createElement('section');
  box.setAttribute('data-as-lockout', '');
  box.setAttribute('aria-live', 'polite');
  box.setAttribute('style', 'margin:24px auto;max-width:560px;padding:20px;border:2px dashed #b7791f;border-radius:10px;font:15px/1.5 system-ui,sans-serif');
  const heading = doc.createElement('h2');
  heading.textContent = config.title;
  const text = doc.createElement('p');
  text.textContent = config.message;
  box.append(heading, text);
  box.append(verifyControl(ctx, 'lockout'));
  ctx.own(box);
  return box;
}

/** A button that runs step-up and, on success, announces `human-verified` for every protection responder. */
function verifyControl(ctx, by) {
  const { document: doc, config } = ctx;
  if (!ctx.service('step-up')) {
    const p = doc.createElement('p');
    p.textContent = config.noVerifyMessage;
    return p;
  }
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = config.verifyLabel;
  button.addEventListener('click', async (event) => {
    if (!event.isTrusted) return ctx.log('verify-refused', { why: 'untrusted click' });
    button.disabled = true;
    const { verified, reason } = await ctx.service('step-up')(`${by}-unlock`);
    button.disabled = false;
    if (verified) ctx.log('human-verified', { by });
    else ctx.log('verify-failed', { reason });
  });
  return button;
}

function threshold(ctx) {
  const fromPage = Number(ctx.document?.documentElement?.getAttribute(ctx.config.thresholdAttribute));
  return Number.isFinite(fromPage) && fromPage > 0 ? fromPage : ctx.config.threshold;
}

function pageLevel(ctx) {
  if (ctx.config.level != null) return Number(ctx.config.level);
  return Number(ctx.document?.documentElement?.getAttribute(ctx.config.levelAttribute) ?? 0) || 0;
}
