/**
 * Request handler for Node's http server (or anything with the same req/res).
 *
 *   const antiSmith = createAntiSmithHandler({ lists, onRecord: (record) => appendToLog(record) });
 *   http.createServer(async (req, res) => {
 *     if (await antiSmith.handle(req, res)) return;   // its own routes
 *     const seen = await antiSmith.inspect(req);      // any other request: signals, Web Bot Auth, canaries
 *     ...
 *   });
 *
 * Routes:
 *   POST /log         client events from sink.http-log → records + session update
 *   POST /api/flag    responder.notify-server → session flag
 *   *    /__as_trap/* honeypot targets → trap-hit record, 204
 *   POST /api/step-up/{register,assert}/{options,verify}
 *                     responder.step-up, when `stepUp` (createStepUp) and `getUserId(req)` are given
 *
 * Every observation is passed to `onRecord(record)`; storage is the caller's choice.
 */
import { collectRequestSignals, classifyRequest } from './signals.js';
import { createCanaryScanner } from './canary.js';
import { createSessionStore } from './sessions.js';
import { verifyWebBotAuth } from './web-bot-auth.js';

export function createAntiSmithHandler(options = {}) {
  const {
    lists = {},
    onRecord = () => {},
    store = createSessionStore(),
    scanner = createCanaryScanner(),
    verify = verifyWebBotAuth,
    verifyOptions = {},
    maxBodyBytes = 1024 * 1024,
    paths = { log: '/log', flag: '/api/flag', trapPrefix: '/__as_trap/', stepUpPrefix: '/api/step-up/' },
    stepUp = null,
    getUserId = () => null,
    allowRegistration = false,
  } = options;
  const agentUserAgents = lists['agent-user-agents']?.data ?? [];

  /** Signals, flags, Web Bot Auth and canary tokens for one request. */
  async function inspect(req, body = '') {
    const signals = collectRequestSignals(req);
    const serverFlags = classifyRequest(signals, { agentUserAgents });
    const webBotAuth = await verify(req, { scheme: req.socket?.encrypted ? 'https' : 'http', ...verifyOptions });
    const canaryTokens = scanner.scanRequest(req, body);
    if (webBotAuth.present) onRecord({ kind: 'web-bot-auth', ...webBotAuth, path: req.url, receivedAt: signals.receivedAt });
    for (const token of canaryTokens) {
      const planted = store.findByCanary(token);
      onRecord({ kind: 'canary-hit', token, plantedBySession: planted?.id ?? null, path: req.url, ...signals });
      if (planted) store.flag(planted.id, 'canary-replayed', { path: req.url });
    }
    return { signals, serverFlags, webBotAuth, canaryTokens };
  }

  async function handle(req, res) {
    const path = (req.url ?? '').split('?')[0];
    if (req.method === 'POST' && path === paths.log) return handleLog(req, res);
    if (req.method === 'POST' && path === paths.flag) return handleFlag(req, res);
    if (req.method === 'POST' && stepUp && path.startsWith(paths.stepUpPrefix)) return handleStepUp(req, res, path.slice(paths.stepUpPrefix.length));
    if (path.startsWith(paths.trapPrefix)) {
      const seen = await inspect(req);
      onRecord({ kind: 'trap-hit', path: req.url, ...seen.signals, serverFlags: seen.serverFlags });
      reply(res, 204);
      return true;
    }
    return false;
  }

  async function handleLog(req, res) {
    const payload = await readJson(req, res);
    if (!payload) return true;
    const sessionId = String(payload.sessionId ?? '');
    const seen = await inspect(req);
    const events = Array.isArray(payload.events) ? payload.events : [];
    for (const event of events) onRecord({ kind: 'event', sessionId, server: seen.signals, serverFlags: seen.serverFlags, event });

    // Keep a running picture of the session: latest score and the canary token it planted.
    const patch = { serverSignals: seen.signals, serverFlags: seen.serverFlags, webBotAuth: seen.webBotAuth };
    const canaries = events.filter((e) => e?.type === 'canary' && typeof e.data?.token === 'string').map((e) => e.data.token.toUpperCase());
    if (canaries.length) patch.canaryTokens = canaries;
    const lastScore = events.filter((e) => e?.type === 'threshold-crossed' || e?.type === 'runtime.ready').at(-1);
    if (lastScore) patch.lastScore = lastScore.data;
    store.update(sessionId, patch);
    reply(res, 204);
    return true;
  }

  async function handleFlag(req, res) {
    const payload = await readJson(req, res);
    if (!payload) return true;
    const sessionId = String(payload.sessionId ?? '');
    if (!sessionId) {
      reply(res, 400, 'sessionId required');
      return true;
    }
    const seen = await inspect(req);
    const session = store.flag(sessionId, String(payload.reason ?? 'client-flag'), { score: payload.score ?? null, contributors: payload.contributors ?? [] });
    onRecord({ kind: 'session-flag', sessionId, reason: payload.reason ?? 'client-flag', score: payload.score ?? null, server: seen.signals });
    reply(res, 200, JSON.stringify({ flagged: true, flags: session.flags.length }), 'application/json');
    return true;
  }

  async function handleStepUp(req, res, action) {
    const userId = await getUserId(req);
    if (!userId) {
      reply(res, 401, 'no signed-in user');
      return true;
    }
    const payload = (await readJson(req, res)) ?? null;
    if (payload === null) return true;
    const sessionId = String(payload.sessionId ?? '');
    let body;
    switch (action) {
      case 'register/options':
      case 'register/verify':
        if (!allowRegistration) {
          reply(res, 403, 'registration is not allowed here');
          return true;
        }
        body = action === 'register/options' ? stepUp.registrationOptions(userId) : stepUp.verifyRegistration(userId, payload.credential ?? {});
        break;
      case 'assert/options':
        body = stepUp.assertionOptions(userId);
        break;
      case 'assert/verify':
        body = stepUp.verifyAssertion(userId, payload.credential ?? {});
        break;
      default:
        reply(res, 404, 'Not found');
        return true;
    }
    if (action.endsWith('/verify')) {
      onRecord({ kind: 'step-up', action, sessionId, verified: body.verified, reason: body.reason ?? null, receivedAt: new Date().toISOString() });
      if (sessionId) store.update(sessionId, { lastStepUp: { action, verified: body.verified, at: new Date().toISOString() } });
    }
    reply(res, 200, JSON.stringify(body), 'application/json');
    return true;
  }

  async function readJson(req, res) {
    const raw = await readBody(req, maxBodyBytes);
    if (raw === null) {
      reply(res, 413, 'Too large');
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      reply(res, 400, 'Invalid JSON');
      return null;
    }
  }

  return { handle, inspect, store };
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        resolve(null);
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function reply(res, status, body = '', type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}
