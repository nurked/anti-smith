/**
 * What the server can see about a request, without trusting the page.
 *
 * TLS fingerprints (JA3/JA4) are not available inside Node's HTTP server; put
 * them in a header at the edge (nginx, Cloudflare, a load balancer) and list
 * that header in `fingerprintHeaders`.
 */
export function collectRequestSignals(req, { fingerprintHeaders = ['x-ja4', 'cf-ja4', 'x-ja3'] } = {}) {
  const h = req.headers ?? {};
  const socket = req.socket ?? {};
  const upstream = {};
  for (const name of fingerprintHeaders) if (h[name]) upstream[name] = h[name];
  return {
    receivedAt: new Date().toISOString(),
    remote: socket.remoteAddress ?? null,
    method: req.method,
    path: req.url,
    userAgent: h['user-agent'] ?? null,
    acceptLanguage: h['accept-language'] ?? null,
    accept: h.accept ?? null,
    clientHints: {
      secChUa: h['sec-ch-ua'] ?? null,
      mobile: h['sec-ch-ua-mobile'] ?? null,
      platform: h['sec-ch-ua-platform'] ?? null,
    },
    fetchMetadata: {
      site: h['sec-fetch-site'] ?? null,
      mode: h['sec-fetch-mode'] ?? null,
      dest: h['sec-fetch-dest'] ?? null,
      user: h['sec-fetch-user'] ?? null,
    },
    // Header *order* differs between real browsers and HTTP libraries; keep names only, never values.
    headerOrder: rawHeaderNames(req),
    signatureAgent: h['signature-agent'] ?? null,
    tls: {
      protocol: typeof socket.getProtocol === 'function' ? socket.getProtocol() : null,
      cipher: typeof socket.getCipher === 'function' ? socket.getCipher()?.name ?? null : null,
      alpn: socket.alpnProtocol ?? null,
    },
    upstreamFingerprints: upstream,
  };
}

/**
 * Flags from server-visible data alone. `agentUserAgents` comes from
 * lists/agent-user-agents.json: [{ pattern, name, kind }].
 */
export function classifyRequest(signals, { agentUserAgents = [] } = {}) {
  const flags = [];
  const ua = signals.userAgent ?? '';
  for (const entry of agentUserAgents) {
    if (new RegExp(entry.pattern, 'i').test(ua)) flags.push({ flag: 'agent-user-agent', name: entry.name, kind: entry.kind });
  }
  if (!ua) flags.push({ flag: 'no-user-agent' });
  if (!signals.acceptLanguage) flags.push({ flag: 'no-accept-language' });
  const claimsChromium = /\b(?:Chrome|Chromium)\/\d+/.test(ua);
  // Chromium sends Fetch Metadata on every request, and low-entropy client hints on secure contexts (localhost counts).
  if (claimsChromium && !signals.fetchMetadata.site) flags.push({ flag: 'chromium-ua-without-fetch-metadata' });
  if (claimsChromium && !signals.clientHints.secChUa) flags.push({ flag: 'chromium-ua-without-client-hints' });
  if (signals.clientHints.secChUa && /Headless/i.test(signals.clientHints.secChUa)) flags.push({ flag: 'headless-client-hint' });
  return flags;
}

function rawHeaderNames(req) {
  const raw = req.rawHeaders;
  if (!Array.isArray(raw)) return Object.keys(req.headers ?? {});
  const names = [];
  for (let i = 0; i < raw.length; i += 2) names.push(String(raw[i]).toLowerCase());
  return names;
}
