/**
 * Append-only, in-memory event log with subscribers.
 *
 * Every observation in anti-smith is an event:
 *   { seq, t, at, source, type, data }
 * `t` is milliseconds since the runtime started, `at` is wall-clock ISO time,
 * `source` is a plugin id or "core". Sinks subscribe to ship events elsewhere.
 */
export function createEventLog({ now = () => 0, limit = 20000 } = {}) {
  const events = [];
  const subscribers = new Set();
  let seq = 0;
  let dropped = 0;

  return {
    push(source, type, data = null) {
      const event = { seq: ++seq, t: now(), at: new Date().toISOString(), source, type, data };
      events.push(event);
      if (events.length > limit) {
        events.shift();
        dropped++;
      }
      for (const fn of subscribers) {
        try {
          fn(event);
        } catch {
          // A broken subscriber must never break logging for everyone else.
        }
      }
      return event;
    },
    subscribe(fn) {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    all: () => events.slice(),
    clear() {
      events.length = 0;
    },
    toJSON: () => ({ dropped, events: events.slice() }),
  };
}
