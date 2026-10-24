/**
 * Patched built-ins. Stealth plugins override navigator getters, permissions,
 * WebGL and Function.prototype.toString itself to look human. This detector
 * stringifies those functions with the page's toString and with a pristine
 * toString from a fresh iframe, and checks for shape differences (a `prototype`
 * property on a "native" method, own properties on the navigator instance).
 */
const TARGETS = [
  // [owner path, property, slot, stealth-relevant]
  ['Navigator.prototype', 'webdriver', 'get', true],
  ['Navigator.prototype', 'plugins', 'get', true],
  ['Navigator.prototype', 'languages', 'get', true],
  ['Navigator.prototype', 'hardwareConcurrency', 'get', true],
  ['Navigator.prototype', 'userAgent', 'get', true],
  ['Navigator.prototype', 'platform', 'get', true],
  ['Navigator.prototype', 'deviceMemory', 'get', true],
  ['Permissions.prototype', 'query', 'value', true],
  ['Notification', 'permission', 'get', true],
  ['HTMLCanvasElement.prototype', 'toDataURL', 'value', true],
  ['HTMLCanvasElement.prototype', 'getContext', 'value', true],
  ['WebGLRenderingContext.prototype', 'getParameter', 'value', true],
  ['WebGL2RenderingContext.prototype', 'getParameter', 'value', true],
  ['Function.prototype', 'toString', 'value', true],
  ['Document.prototype', 'hasFocus', 'value', true],
  ['Document.prototype', 'visibilityState', 'get', true],
  ['Document.prototype', 'hidden', 'get', true],
  ['Element.prototype', 'attachShadow', 'value', false],
  ['Element.prototype', 'getBoundingClientRect', 'value', false],
  ['EventTarget.prototype', 'addEventListener', 'value', false],
  ['EventTarget.prototype', 'dispatchEvent', 'value', false],
  ['Date.prototype', 'getTimezoneOffset', 'value', false],
  ['Intl.DateTimeFormat.prototype', 'resolvedOptions', 'value', false],
  ['MediaDevices.prototype', 'enumerateDevices', 'value', false],
];

export default {
  id: 'detector.native-patches',
  kind: 'detector',
  version: '0.1.0',
  title: 'Patched native functions',
  description: 'Finds built-ins whose source is not "[native code]", that disagree with a pristine iframe toString, or that have the wrong shape — the footprint of stealth plugins.',
  weight: 'medium',
  phase: 'static',
  tags: ['stealth', 'fingerprint'],
  limitations: [
    'Legitimate libraries patch some of these too (zone.js and error trackers wrap addEventListener; privacy extensions patch canvas). Those count as suspicious, not detected.',
    'A careful stealth kit patches the iframe realm as well, or uses Proxy objects that stringify as native. puppeteer-extra-plugin-stealth passes this detector (2026-10-24); its spoofed values are caught by detector.headless and detector.permissions-consistency instead.',
    'Patches made by anti-smith itself are skipped via ctx.isOwnPatch().',
  ],

  start(ctx) {
    const { window: win, document: doc } = ctx;
    const pristineToString = iframeToString(ctx);
    const patched = [];
    const missing = [];

    for (const [path, key, slot, stealth] of TARGETS) {
      const owner = resolve(win, path);
      if (!owner) continue;
      const descriptor = Object.getOwnPropertyDescriptor(owner, key);
      const fn = descriptor?.[slot];
      if (typeof fn !== 'function') {
        if (path === 'Navigator.prototype' && key === 'webdriver' && /Chrome\//.test(win.navigator?.userAgent ?? '')) {
          missing.push(`${path}.${key}`);
        }
        continue;
      }
      if (ctx.isOwnPatch(fn)) continue;

      const reasons = [];
      if (!ctx.isNative(fn)) reasons.push('page toString is not native');
      if (pristineToString) {
        const source = safe(() => pristineToString.call(fn));
        if (source !== null && !/\[native code\]/.test(source)) reasons.push('pristine iframe toString is not native');
      }
      if (Object.prototype.hasOwnProperty.call(fn, 'prototype')) reasons.push('has a prototype property (native methods do not)');
      if (reasons.length) patched.push({ target: `${path}.${key}${slot === 'get' ? ' (getter)' : ''}`, stealth, reasons });
    }

    const navigatorOwn = safe(() => Object.getOwnPropertyNames(win.navigator ?? {})) ?? [];
    const evidence = { patched, missing, navigatorOwnProperties: navigatorOwn, pristineRealm: Boolean(pristineToString) };

    if (patched.some((p) => p.stealth) || missing.length) return ctx.report({ status: 'detected', evidence });
    if (patched.length || navigatorOwn.length) return ctx.report({ status: 'suspicious', evidence });
    return ctx.report({ status: 'clean', evidence: { checked: TARGETS.length, pristineRealm: evidence.pristineRealm } });
  },
};

function resolve(win, path) {
  return path.split('.').reduce((obj, part) => (obj == null ? obj : obj[part]), win);
}

/** Borrows Function.prototype.toString from a fresh same-origin iframe, then removes the iframe. */
function iframeToString(ctx) {
  const doc = ctx.document;
  if (!doc?.createElement || !doc.body) return null;
  const frame = doc.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('data-as-ignore', '');
  frame.tabIndex = -1;
  frame.style.display = 'none';
  ctx.own(frame);
  try {
    doc.body.appendChild(frame);
    return frame.contentWindow?.Function?.prototype?.toString ?? null;
  } catch {
    return null;
  } finally {
    frame.remove();
  }
}

function safe(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}
