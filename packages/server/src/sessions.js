/**
 * In-memory session correlation: joins what the page reported (findings,
 * score, canary token) with what the server saw (request signals, Web Bot
 * Auth result, trap and canary hits) under the client's session id.
 *
 * In-memory and bounded on purpose; production deployments swap in a shared
 * store with the same interface (get / update / flag / list).
 */
export function createSessionStore({ maxSessions = 10000, ttlMs = 24 * 60 * 60 * 1000, now = Date.now } = {}) {
  const sessions = new Map();

  function evict() {
    const cutoff = now() - ttlMs;
    for (const [id, session] of sessions) {
      if (session.updatedAt < cutoff || sessions.size > maxSessions) sessions.delete(id);
      else break; // Map keeps insertion order; refreshed sessions are re-inserted at the end
    }
  }

  function update(id, patch = {}) {
    if (!id) return null;
    const existing = sessions.get(id) ?? { id, createdAt: now(), flags: [], canaryTokens: [], serverFlags: [] };
    sessions.delete(id);
    const merged = { ...existing, ...patch, updatedAt: now() };
    merged.canaryTokens = [...new Set([...(existing.canaryTokens ?? []), ...(patch.canaryTokens ?? [])])];
    merged.serverFlags = dedupe([...(existing.serverFlags ?? []), ...(patch.serverFlags ?? [])]);
    merged.flags = existing.flags;
    sessions.set(id, merged);
    evict();
    return merged;
  }

  function flag(id, reason, details = {}) {
    const session = update(id);
    if (!session) return null;
    session.flags.push({ at: new Date(now()).toISOString(), reason, ...details });
    return session;
  }

  /** Which session planted this canary token (detector.honeypots logs it). */
  function findByCanary(token) {
    for (const session of sessions.values()) if (session.canaryTokens.includes(token)) return session;
    return null;
  }

  return {
    get: (id) => sessions.get(id) ?? null,
    update,
    flag,
    findByCanary,
    list: () => [...sessions.values()],
    flagged: () => [...sessions.values()].filter((s) => s.flags.length),
  };
}

function dedupe(flags) {
  const seen = new Set();
  return flags.filter((f) => {
    const key = JSON.stringify(f);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
