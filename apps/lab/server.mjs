#!/usr/bin/env node
/**
 * Lab server. Node built-ins only, binds to 127.0.0.1.
 *
 *   GET  /                 → redirect to the lab page
 *   GET  /api/plugins      → every plugin entry point found under plugins/
 *   GET  /api/lists        → every signal list under lists/, { [name]: { version, data } }
 *   POST /log              → append { sessionId, events } as JSON lines to var/detections.log
 *   GET  /__as_trap/*      → honeypot target: log the hit, answer 204 (no navigation)
 *   GET  /apps|packages|plugins/...  → static files
 *
 * Every log line also records what the server saw (user agent, client hints,
 * accept-language), so client-side and server-side views can be compared.
 * Any request carrying a canary token (outside /log) is logged as canary-hit.
 *
 * Usage: npm start   (PORT and LOG_FILE env vars override the defaults)
 */
import http from 'node:http';
import { readFile, appendFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoverPlugins } from '../../tools/lib/discover-plugins.mjs';
import { loadLists } from '../../tools/lib/load-lists.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 8787);
const LOG_FILE = path.resolve(process.env.LOG_FILE ?? path.join(ROOT, 'var', 'detections.log'));
const MAX_BODY = 1024 * 1024;
const STATIC_PREFIXES = ['/apps/', '/packages/', '/plugins/'];
const CANARY = /AS-CANARY-[0-9A-F]+/i;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

await mkdir(path.dirname(LOG_FILE), { recursive: true });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  try {
    if (url.pathname !== '/log' && CANARY.test(decodeURIComponent(req.url))) {
      await writeLines([{ kind: 'canary-hit', path: url.pathname, token: decodeURIComponent(req.url).match(CANARY)[0], ...seen(req) }]);
    }
    if (req.method === 'GET' && url.pathname === '/') return redirect(res, '/apps/lab/');
    if (req.method === 'GET' && url.pathname === '/api/plugins') return json(res, await pluginList());
    if (req.method === 'GET' && url.pathname === '/api/lists') return json(res, await loadLists(ROOT));
    if (req.method === 'POST' && url.pathname === '/log') return await handleLog(req, res);
    if (url.pathname.startsWith('/__as_trap/')) {
      await writeLines([{ kind: 'trap-hit', path: url.pathname, query: url.search, ...seen(req) }]);
      return end(res, 204);
    }
    if (req.method === 'GET' && url.pathname === '/favicon.ico') return end(res, 204);
    if (req.method === 'GET' && STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return await serveStatic(url.pathname, res);
    return end(res, 404, 'Not found');
  } catch (error) {
    console.error(error);
    return end(res, 500, 'Server error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`anti-smith lab → http://${HOST}:${PORT}/apps/lab/`);
  console.log(`logging to ${path.relative(ROOT, LOG_FILE)}`);
});

async function pluginList() {
  return (await discoverPlugins(ROOT)).map(({ id, kind, urlPath }) => ({ id, kind, path: urlPath }));
}

async function handleLog(req, res) {
  const raw = await readBody(req);
  if (raw === null) return end(res, 413, 'Too large');
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return end(res, 400, 'Invalid JSON');
  }
  const events = Array.isArray(payload?.events) ? payload.events : [];
  const context = seen(req);
  await writeLines(events.map((event) => ({ kind: 'event', sessionId: String(payload.sessionId ?? ''), ...context, event })));
  return end(res, 204);
}

function seen(req) {
  const h = req.headers;
  return {
    receivedAt: new Date().toISOString(),
    remote: req.socket.remoteAddress,
    server: {
      userAgent: h['user-agent'] ?? null,
      secChUa: h['sec-ch-ua'] ?? null,
      secChUaPlatform: h['sec-ch-ua-platform'] ?? null,
      acceptLanguage: h['accept-language'] ?? null,
      secFetchSite: h['sec-fetch-site'] ?? null,
      signatureAgent: h['signature-agent'] ?? null,
    },
  };
}

async function writeLines(objects) {
  if (!objects.length) return;
  await appendFile(LOG_FILE, objects.map((o) => JSON.stringify(o)).join('\n') + '\n');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        resolve(null);
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function serveStatic(pathname, res) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.resolve(ROOT, `.${rel}`);
  if (!file.startsWith(ROOT + path.sep)) return end(res, 403, 'Forbidden');
  try {
    if (!(await stat(file)).isFile()) return end(res, 404, 'Not found');
  } catch {
    return end(res, 404, 'Not found');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  res.end(await readFile(file));
}

function json(res, body) {
  res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}

function end(res, status, text = '') {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}
