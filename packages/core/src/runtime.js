import { STATUS, STATUS_RANK, WEIGHTS } from './plugin.js';
import { createRegistry } from './registry.js';
import { createEventLog } from './event-log.js';
import { scoreFindings } from './scoring.js';
import { captureNatives, isNativeFunction } from './natives.js';
import { createOwnership } from './ownership.js';
import { describeNode } from './describe.js';

const START_ORDER = ['sink', 'responder', 'detector'];

/**
 * Creates an anti-smith runtime.
 *
 * The runtime loads plugins, gives each one its own context, collects detector
 * findings, scores them, tells responders about the score and fans every event
 * out to sinks. The runtime itself never blocks or alters the page.
 *
 * @param {object} options
 * @param {object[]} options.plugins   Plugin objects (module default exports).
 * @param {object}   [options.config]  { plugins: { [id]: config }, scoring, logLimit, ownership, sessionId }
 * @param {object}   [options.lists]   Signal lists, { [name]: { version, data } } (see lists/README.md)
 * @param {object}   [options.window]  Defaults to the global window. Tests pass fakes.
 * @param {object}   [options.document]
 * @param {Function} [options.scorer]  (findings, scoringConfig) => { score, level, contributors }
 * @param {Function} [options.now]     Clock override for tests.
 */
export function createRuntime(options = {}) {
  const win = options.window ?? globalThis.window ?? globalThis;
  const doc = options.document ?? win.document ?? null;
  const config = options.config ?? {};
  const lists = options.lists ?? {};
  const scorer = options.scorer ?? scoreFindings;
  const natives = captureNatives(win);
  const clock = options.now ?? natives.now;
  const t0 = clock();
  const elapsed = () => Math.round((clock() - t0) * 10) / 10;
  const sessionId = config.sessionId ?? randomId();

  const log = createEventLog({ now: elapsed, limit: config.logLimit });
  const ownership = createOwnership(doc, config.ownership);
  const registry = createRegistry();
  for (const plugin of options.plugins ?? []) registry.register(plugin);

  const findings = new Map();
  const contexts = new Map();
  const cleanups = new Map();
  const ownPatches = new WeakSet();
  const changeListeners = new Set();
  const services = new Map();
  let score = scorer([], config.scoring);
  let active = [];
  let started = false;

  // ---------------------------------------------------------------- findings

  function setFinding(plugin, input = {}, mode = 'set') {
    if (plugin.kind !== 'detector') throw new Error(`${plugin.id}: only detectors report findings`);
    const { status } = input;
    if (!(status in STATUS_RANK)) {
      log.push('core', 'plugin.bad-status', { plugin: plugin.id, status });
      return findings.get(plugin.id) ?? null;
    }
    const previous = findings.get(plugin.id);
    if (mode === 'escalate' && previous && STATUS_RANK[status] < STATUS_RANK[previous.status]) return previous;

    const weight = WEIGHTS.includes(input.weight) ? input.weight : plugin.weight;
    const next = {
      id: plugin.id,
      title: plugin.title,
      status,
      weight,
      noisy: Boolean(plugin.noisy),
      evidence: input.evidence ?? null,
      reports: (previous?.reports ?? 0) + 1,
      updatedAt: elapsed(),
    };
    findings.set(plugin.id, next);
    // Status changes are logged; evidence refreshes at the same status are not, to keep logs readable.
    if (!previous || previous.status !== status || previous.weight !== weight) {
      log.push(plugin.id, 'finding', { status, weight, evidence: next.evidence });
    }
    rescore();
    return next;
  }

  function rescore() {
    score = scorer([...findings.values()], config.scoring);
    for (const plugin of active) {
      if (plugin.kind !== 'responder') continue;
      const ctx = contexts.get(plugin.id);
      guard(plugin, 'onScore', () => plugin.onScore(score, ctx));
    }
    const view = snapshot();
    for (const fn of changeListeners) {
      try {
        fn(view);
      } catch {
        // UI listeners must not break the runtime.
      }
    }
  }

  // ------------------------------------------------------------ error guard

  function guard(plugin, phase, fn) {
    try {
      return fn();
    } catch (error) {
      fail(plugin, phase, error);
      return undefined;
    }
  }

  function fail(plugin, phase, error) {
    const message = String(error?.message ?? error);
    if (plugin.kind === 'sink' && phase === 'onEvent') {
      // Logging a sink's own failure would be delivered to that sink again; avoid the loop.
      natives.consoleDebug(`[anti-smith] ${plugin.id} ${phase} failed: ${message}`);
      return;
    }
    log.push('core', 'plugin.error', { plugin: plugin.id, phase, message });
    if (plugin.kind === 'detector') setFinding(plugin, { status: STATUS.ERROR, evidence: { phase, message } });
  }

  // --------------------------------------------------------------- patching

  function findDescriptor(target, key) {
    for (let owner = target; owner; owner = natives.getPrototypeOf(owner)) {
      const descriptor = natives.getOwnPropertyDescriptor(owner, key);
      if (descriptor) return { owner, descriptor };
    }
    return null;
  }

  function restorer(target, key, found, installed, read) {
    return () => {
      if (read() !== installed) return; // someone patched over us; leave their patch in place
      if (found.owner === target) natives.defineProperty(target, key, found.descriptor);
      else delete target[key];
    };
  }

  // ------------------------------------------------------------------ lists

  /** "automation-globals.names" → lists['automation-globals'].data.names, or undefined. */
  function resolveList(path) {
    const [name, ...keys] = path.split('.');
    return keys.reduce((value, key) => (value == null ? undefined : value[key]), lists[name]?.data);
  }

  /** Config values a plugin takes from lists. Precedence: plugin defaults < lists < host config. */
  function fromLists(plugin) {
    const values = {};
    for (const [key, path] of Object.entries(plugin.lists ?? {})) {
      const value = resolveList(path);
      if (value !== undefined) values[key] = value;
    }
    return values;
  }

  // ---------------------------------------------------------------- context

  function makeContext(plugin) {
    const list = [];
    cleanups.set(plugin.id, list);

    const ctx = {
      id: plugin.id,
      sessionId,
      config: Object.freeze({ ...(plugin.defaults ?? {}), ...fromLists(plugin), ...(config.plugins?.[plugin.id] ?? {}) }),
      /** Mutable per-plugin, per-runtime scratch space. Keep state here, not in module scope. */
      state: {},
      window: win,
      document: doc,
      natives,
      STATUS,

      now: elapsed,
      log: (type, data) => log.push(plugin.id, type, data),
      report: (finding) => setFinding(plugin, finding, 'set'),
      escalate: (finding) => setFinding(plugin, finding, 'escalate'),
      finding: () => findings.get(plugin.id) ?? null,
      findings: () => [...findings.values()],
      subscribe(fn) {
        const off = log.subscribe((event) => guard(plugin, 'subscribe', () => fn(event)));
        list.push(off);
        return off;
      },

      isNative: (fn) => isNativeFunction(fn, natives),
      isOwnPatch: (fn) => ownPatches.has(fn),
      own: (node) => ownership.claim(node),
      isOwned: (node) => ownership.isOwned(node),
      isIgnored: (node) => ownership.isIgnored(node),
      describe: describeNode,

      /** addEventListener with automatic cleanup and error isolation. Capturing and passive by default. */
      on(target, type, handler, listenerOptions = { capture: true, passive: true }) {
        if (!target || typeof target.addEventListener !== 'function') return () => {};
        const safe = (event) => guard(plugin, `on:${type}`, () => handler(event));
        target.addEventListener(type, safe, listenerOptions);
        const off = () => target.removeEventListener(type, safe, listenerOptions);
        list.push(off);
        return off;
      },
      every(ms, fn) {
        const handle = natives.setInterval(() => guard(plugin, 'every', fn), ms);
        list.push(() => natives.clearInterval(handle));
        return handle;
      },
      after(ms, fn) {
        const handle = natives.setTimeout(() => guard(plugin, 'after', fn), ms);
        list.push(() => natives.clearTimeout(handle));
        return handle;
      },
      onCleanup(fn) {
        list.push(fn);
      },

      /**
       * Services let plugins cooperate without importing each other: one plugin
       * provides a named function (responder.step-up provides "step-up"), others
       * look it up at call time and must cope with it being absent.
       */
      provide(name, fn) {
        if (services.has(name)) throw new Error(`service "${name}" is already provided by ${services.get(name).by}`);
        services.set(name, { fn, by: plugin.id });
        list.push(() => services.get(name)?.by === plugin.id && services.delete(name));
      },
      service: (name) => services.get(name)?.fn ?? null,

      /**
       * Observe calls to `target[key]` without changing behaviour: the original
       * runs first, its result is returned untouched, then `onCall` sees
       * { thisArg, args, result }. Errors in `onCall` are isolated.
       */
      observeCall(target, key, onCall) {
        const found = target && findDescriptor(target, key);
        if (!found || typeof found.descriptor.value !== 'function') return false;
        const original = found.descriptor.value;
        let busy = false;
        const observed = function (...args) {
          const result = new.target ? Reflect.construct(original, args, new.target) : original.apply(this, args);
          if (!busy) {
            busy = true;
            try {
              guard(plugin, `call:${String(key)}`, () => onCall({ thisArg: this, args, result }));
            } finally {
              busy = false;
            }
          }
          return result;
        };
        ownPatches.add(observed);
        natives.defineProperty(target, key, {
          configurable: true,
          enumerable: found.descriptor.enumerable,
          writable: true,
          value: observed,
        });
        list.push(restorer(target, key, found, observed, () => target[key]));
        return true;
      },

      /** Same as observeCall, for accessor properties (e.g. innerText on one element). */
      observeGetter(target, key, onGet) {
        const found = target && findDescriptor(target, key);
        if (!found || typeof found.descriptor.get !== 'function') return false;
        const getter = found.descriptor.get;
        let busy = false;
        const observed = function () {
          const value = getter.call(this);
          if (!busy) {
            busy = true;
            try {
              guard(plugin, `get:${String(key)}`, () => onGet({ thisArg: this, value }));
            } finally {
              busy = false;
            }
          }
          return value;
        };
        ownPatches.add(observed);
        natives.defineProperty(target, key, {
          configurable: true,
          enumerable: found.descriptor.enumerable,
          get: observed,
          set: found.descriptor.set,
        });
        list.push(restorer(target, key, found, observed, () => natives.getOwnPropertyDescriptor(target, key)?.get));
        return true;
      },
    };
    return Object.freeze(ctx);
  }

  // -------------------------------------------------------------- lifecycle

  function isEnabled(plugin) {
    const override = config.plugins?.[plugin.id]?.enabled;
    return (override ?? plugin.defaults?.enabled) !== false;
  }

  async function start() {
    if (started) return snapshot();
    started = true;
    ownership.snapshot();

    const all = registry.list();
    active = START_ORDER.flatMap((kind) => all.filter((p) => p.kind === kind && isEnabled(p)));
    const disabled = all.filter((p) => !isEnabled(p)).map((p) => p.id);
    for (const plugin of active) contexts.set(plugin.id, makeContext(plugin));

    // Sinks subscribe first so they also receive everything logged during start-up.
    for (const plugin of active.filter((p) => p.kind === 'sink')) {
      const ctx = contexts.get(plugin.id);
      cleanups.get(plugin.id).push(log.subscribe((event) => guard(plugin, 'onEvent', () => plugin.onEvent(event, ctx))));
    }

    log.push('core', 'runtime.start', {
      sessionId,
      plugins: active.map((p) => `${p.id}@${p.version}`),
      disabled,
      lists: Object.fromEntries(Object.entries(lists).map(([name, list]) => [name, list?.version ?? null])),
      url: win.location?.href ?? null,
      userAgent: win.navigator?.userAgent ?? null,
    });
    for (const plugin of active) {
      if (plugin.kind === 'detector') {
        findings.set(plugin.id, {
          id: plugin.id,
          title: plugin.title,
          status: STATUS.PENDING,
          weight: plugin.weight,
          noisy: Boolean(plugin.noisy),
          evidence: null,
          reports: 0,
          updatedAt: elapsed(),
        });
      }
    }
    rescore();

    // Synchronous parts of start() run in START_ORDER; async detectors then settle in parallel.
    await Promise.all(active.map((plugin) => startPlugin(plugin)));
    log.push('core', 'runtime.ready', { score: score.score, level: score.level });
    return snapshot();
  }

  async function startPlugin(plugin) {
    if (typeof plugin.start !== 'function') return;
    try {
      const stop = await plugin.start(contexts.get(plugin.id));
      if (typeof stop === 'function') cleanups.get(plugin.id).push(stop);
    } catch (error) {
      fail(plugin, 'start', error);
    }
  }

  /** Stops detectors first, then responders, then sinks, so sinks can flush the final events. */
  function stop() {
    if (!started) return;
    log.push('core', 'runtime.stop', { score: score.score, level: score.level });
    for (const plugin of [...active].reverse()) {
      const list = cleanups.get(plugin.id) ?? [];
      while (list.length) {
        try {
          list.pop()();
        } catch {
          // Cleanup is best effort.
        }
      }
    }
    started = false;
  }

  function pluginMeta(plugin) {
    const { id, kind, version, title, description, weight, phase, tags, noisy, limitations } = plugin;
    return { id, kind, version, title, description, weight, phase, tags, noisy: Boolean(noisy), limitations, lists: plugin.lists, enabled: isEnabled(plugin) };
  }

  function snapshot() {
    return { sessionId, score, findings: [...findings.values()] };
  }

  return {
    sessionId,
    natives,
    log,
    registry,
    start,
    stop,
    snapshot,
    score: () => score,
    findings: () => [...findings.values()],
    plugins: () => registry.list().map(pluginMeta),
    /** Host pages call this for nodes they create after start, so DOM detectors ignore them. */
    claim: (node) => ownership.claim(node),
    /**
     * Call synchronously right after the page renders (React layout effect, Vue updated hook,
     * htmx:afterSwap): DOM detectors take their pending records and treat those nodes as the page's.
     */
    adoptPending: () => services.get('adopt-mutations')?.fn() ?? 0,
    onChange(fn) {
      changeListeners.add(fn);
      return () => changeListeners.delete(fn);
    },
    exportJSON(meta = {}) {
      return {
        format: 'anti-smith.export/v1',
        exportedAt: new Date().toISOString(),
        sessionId,
        meta,
        score,
        findings: [...findings.values()],
        plugins: registry.list().map(pluginMeta),
        log: log.toJSON(),
      };
    },
  };
}

function randomId() {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
