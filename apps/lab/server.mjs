#!/usr/bin/env node
/**
 * Lab server. Node built-ins only, binds to 127.0.0.1.
 *
 *   GET  /                 → redirect to the lab page
 *   GET  /api/plugins      → every plugin entry point found under plugins/
 *   GET  /api/lists        → every signal list under lists/, { [name]: { version, data } }
 *   GET  /api/sessions     → correlated sessions (lab only: client findings + server signals)
 *   POST /log              → client events (sink.http-log)            ┐
 *   POST /api/flag         → session flags (responder.notify-server)  ├ handled by @anti-smith/server
 *   POST /api/step-up/*    → WebAuthn step-up (responder.step-up)     │
 *   *    /__as_trap/*      → honeypot targets, 204                    ┘
 *   GET  /apps|packages|plugins/...  → static files
 *
 * Every request is also inspected by @anti-smith/server: Web Bot Auth
 * signatures, canary tokens and agent user agents are recorded as they appear.
 * Records are appended as JSON lines to var/detections.log.
 *
 * Usage: npm start   (PORT and LOG_FILE env vars override the defaults)
 */
import http from 'node:http';
import { readFile, appendFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAntiSmithHandler, createStepUp } from '../../packages/server/src/index.js';
import { discoverPlugins } from '../../tools/lib/discover-plugins.mjs';
import { loadLists } from '../../tools/lib/load-lists.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 8787);
const LOG_FILE = path.resolve(process.env.LOG_FILE ?? path.join(ROOT, 'var', 'detections.log'));
const STATIC_PREFIXES = ['/apps/', '/packages/', '/plugins/'];
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

// Appends are queued so concurrent requests never interleave partial lines.
let writing = Promise.resolve();
const record = (entry) => {
  writing = writing.then(() => appendFile(LOG_FILE, `${JSON.stringify(entry)}\n`)).catch((error) => console.error(error));
};

const antiSmith = createAntiSmithHandler({
  lists: await loadLists(ROOT),
  onRecord: record,
  // Step-up for one fake lab user. Registration on demand is a lab convenience only (ADR 0005).
  stepUp: createStepUp({ rpId: 'localhost', origins: [`http://localhost:${PORT}`] }),
  getUserId: () => 'lab-user',
  allowRegistration: true,
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  try {
    if (await antiSmith.handle(req, res)) return;
    await antiSmith.inspect(req);
    if (req.method !== 'GET') return end(res, 404, 'Not found');
    if (url.pathname === '/') return redirect(res, '/apps/lab/');
    if (url.pathname === '/api/plugins') return json(res, await pluginList());
    if (url.pathname === '/api/lists') return json(res, await loadLists(ROOT));
    if (url.pathname === '/api/sessions') return json(res, antiSmith.store.list());
    if (url.pathname === '/favicon.ico') return end(res, 204);
    if (STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return await serveStatic(url.pathname, res);
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
