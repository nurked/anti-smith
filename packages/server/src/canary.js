/**
 * Finds canary tokens (planted per session by detector.honeypots) in anything
 * that reaches the server: URLs, form posts, JSON bodies, support tickets,
 * model outputs pasted back into a form. A hit means page content was
 * harvested and replayed by a machine.
 */
export const DEFAULT_CANARY_PATTERN = /AS-CANARY-[0-9A-F]{6,}/gi;

export function createCanaryScanner({ pattern = DEFAULT_CANARY_PATTERN } = {}) {
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);

  /** Unique tokens (upper-cased) found in a string. */
  function scanText(text) {
    if (typeof text !== 'string' || !text) return [];
    return [...new Set(Array.from(text.matchAll(re), (m) => m[0].toUpperCase()))];
  }

  /** Walks strings inside any JSON-like value (objects, arrays, form fields). */
  function scanValue(value, depth = 0) {
    if (depth > 20 || value == null) return [];
    if (typeof value === 'string') return scanText(value);
    if (typeof value !== 'object') return [];
    const found = new Set();
    for (const child of Array.isArray(value) ? value : Object.values(value)) {
      for (const token of scanValue(child, depth + 1)) found.add(token);
    }
    return [...found];
  }

  /** Scans a request URL (decoded) and an optional body string. */
  function scanRequest(req, body = '') {
    let url = req.url ?? '';
    try {
      url = decodeURIComponent(url);
    } catch {
      // keep the raw URL
    }
    return [...new Set([...scanText(url), ...scanText(body)])];
  }

  return { scanText, scanValue, scanRequest };
}
