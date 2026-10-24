/**
 * Pristine references to built-ins, captured once when a runtime is created.
 *
 * Detectors use these so their own bookkeeping is not affected by patches
 * other scripts make later, and so their reads do not trip other detectors
 * (for example, the sensitive-reads detector observes querySelectorAll).
 *
 * Limitation: anything injected *before* the runtime loads (Playwright
 * `addInitScript`, extension content scripts at document_start) can patch
 * these first. That is why native-patch detection exists as its own plugin.
 */
export function captureNatives(win = globalThis) {
  const global = globalThis;
  const bind = (name) => {
    if (typeof win[name] === 'function') return win[name].bind(win);
    return typeof global[name] === 'function' ? global[name].bind(global) : null;
  };
  const perf = win.performance ?? global.performance;
  const con = win.console ?? global.console;

  return Object.freeze({
    fnToString: Function.prototype.toString,
    now: perf && typeof perf.now === 'function' ? perf.now.bind(perf) : Date.now,
    setTimeout: bind('setTimeout'),
    clearTimeout: bind('clearTimeout'),
    setInterval: bind('setInterval'),
    clearInterval: bind('clearInterval'),
    requestAnimationFrame: typeof win.requestAnimationFrame === 'function' ? win.requestAnimationFrame.bind(win) : null,
    cancelAnimationFrame: typeof win.cancelAnimationFrame === 'function' ? win.cancelAnimationFrame.bind(win) : null,
    defineProperty: Object.defineProperty,
    getOwnPropertyDescriptor: Object.getOwnPropertyDescriptor,
    getPrototypeOf: Object.getPrototypeOf,
    consoleDebug: con && typeof con.debug === 'function' ? con.debug.bind(con) : () => {},
    querySelectorAll: win.Document?.prototype?.querySelectorAll ?? null,
    getSelection: typeof win.getSelection === 'function' ? win.getSelection.bind(win) : null,
  });
}

const NATIVE_SOURCE = /^function\s+(?:get\s+|set\s+)?[^(]*\(\)\s*\{\s*\[native code\]\s*\}$/;

/** True when `fn` stringifies like a built-in (using the captured toString). */
export function isNativeFunction(fn, natives) {
  if (typeof fn !== 'function') return false;
  try {
    return NATIVE_SOURCE.test(natives.fnToString.call(fn));
  } catch {
    return false;
  }
}
