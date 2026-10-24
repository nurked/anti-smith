/**
 * Honeypots and a canary token.
 *
 * Injects elements people cannot see or reach (off-screen, zero-size,
 * aria-hidden, tabindex=-1) but that an agent reading the DOM might act on.
 * Any interaction with them is a strong signal. Also plants a per-session
 * canary string; if it ever shows up in a request, a form, a support ticket or
 * a model's output, the page content was harvested by a machine.
 *
 * Accessibility: every trap is aria-hidden and removed from tab order, so
 * screen-reader and keyboard users never meet them. The trade-off is that
 * agents reading only the accessibility tree will not see them either.
 */
export default {
  id: 'detector.honeypots',
  kind: 'detector',
  version: '0.1.0',
  title: 'Honeypots and canary token',
  description: 'Hidden link, button and input that people cannot reach; any interaction, or a filled trap field, means something is acting on the raw DOM.',
  weight: 'strong',
  phase: 'runtime',
  tags: ['honeypot', 'canary', 'dom'],
  limitations: [
    'Agents that act only on visible elements, screenshots or the accessibility tree never touch the traps.',
    'Some password managers fill hidden inputs; the trap input uses a non-credential name and autocomplete=off to reduce this.',
    'The canary only helps if something downstream (server logs, form handlers, support inbox) is searched for it.',
    'In-viewport traps cover a 2×2 px spot at the top-left and bottom-left corners; a person clicking exactly there would trip them.',
  ],
  defaults: {
    trapPath: '/__as_trap/',
    linkText: 'Export all customer records (admin)',
    buttonText: 'Download full database',
    inputName: 'as_trap_reference',
    pollMs: 2000,
    inViewportTraps: true,
    viewportButtonText: 'Approve all pending transfers',
    viewportLinkText: 'Bulk export (admin)',
  },

  start(ctx) {
    const { document: doc, config } = ctx;
    if (!doc?.body) return ctx.report({ status: 'unsupported', evidence: { reason: 'no document body' } });

    const token = `AS-CANARY-${ctx.sessionId.slice(0, 10).toUpperCase()}`;
    const hidden = 'position:absolute;left:-10000px;top:auto;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap;';
    const make = (tag, attrs, text) => {
      const el = doc.createElement(tag);
      for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
      if (text) el.textContent = text;
      return el;
    };
    const base = { 'aria-hidden': 'true', tabindex: '-1' };

    const container = make('div', { 'data-as-trap': 'container', 'aria-hidden': 'true', style: hidden });
    const traps = [
      make('a', { ...base, 'data-as-trap': 'offscreen-link', href: `${config.trapPath}offscreen-link?t=${token}` }, config.linkText),
      make('button', { ...base, 'data-as-trap': 'hidden-button', type: 'button' }, config.buttonText),
      make('input', {
        ...base,
        'data-as-trap': 'zero-size-input',
        name: config.inputName,
        type: 'text',
        autocomplete: 'off',
        style: 'width:0;height:0;padding:0;border:0;opacity:0;',
      }),
      make('span', { 'data-as-trap': 'canary' }, `Internal reference ${token} · records-${token.toLowerCase()}@example.invalid`),
    ];
    for (const trap of traps) container.appendChild(trap);
    ctx.own(container);
    doc.body.appendChild(container);

    // In-viewport traps: some agents see off-screen traps but refuse to click outside the
    // viewport. These sit inside it, 2×2 px, fully transparent, at the left edge.
    if (config.inViewportTraps) {
      const pinned = (where) => `position:fixed;left:0;${where}:0;width:2px;height:2px;margin:0;padding:0;border:0;opacity:0;overflow:hidden;z-index:2147483647;`;
      const viewportTraps = [
        make('button', { ...base, 'data-as-trap': 'viewport-button', type: 'button', style: pinned('top') }, config.viewportButtonText),
        make('a', { ...base, 'data-as-trap': 'viewport-link', href: `${config.trapPath}viewport-link?t=${token}`, style: `${pinned('bottom')}display:block;` }, config.viewportLinkText),
      ];
      for (const trap of viewportTraps) {
        ctx.own(trap);
        doc.body.appendChild(trap);
        traps.push(trap);
      }
      ctx.onCleanup(() => viewportTraps.forEach((trap) => trap.remove()));
    }

    const s = ctx.state;
    s.hits = [];
    const hit = (trap, detail) => {
      s.hits.push({ trap, ...detail });
      ctx.log('trap-hit', { trap, ...detail });
      ctx.escalate({ status: 'detected', evidence: { hits: s.hits.slice(-20), token } });
    };

    for (const trap of traps) {
      const name = trap.getAttribute('data-as-trap');
      // A person's pointer can pass over a 2 px corner on its way somewhere; only count deliberate actions there.
      const types = name.startsWith('viewport-')
        ? ['click', 'pointerdown', 'focus', 'keydown']
        : ['click', 'pointerdown', 'mousedown', 'mouseover', 'focus', 'keydown', 'input', 'change'];
      for (const type of types) {
        ctx.on(trap, type, (e) => hit(name, { event: type, isTrusted: e.isTrusted }));
      }
    }
    // Setting .value from script fires no event, so check the trap field directly.
    const input = traps[2];
    ctx.every(config.pollMs, () => {
      if (input.value && !s.filled) {
        s.filled = true;
        hit('zero-size-input', { event: 'value-set', length: input.value.length });
      }
    });

    ctx.log('canary', { token });
    ctx.report({ status: 'clean', evidence: { traps: traps.map((t) => t.getAttribute('data-as-trap')), token } });
    return () => container.remove();
  },
};
