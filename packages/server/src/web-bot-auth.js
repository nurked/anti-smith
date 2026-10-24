/**
 * Web Bot Auth: verify that a request was signed by the operator named in its
 * Signature-Agent header, using HTTP Message Signatures (RFC 9421) with Ed25519
 * keys published at <agent origin>/.well-known/http-message-signatures-directory.
 *
 * Verification proves *who operates* the agent. It says nothing about what the
 * agent may do — that is the site's policy (allow-list, deny-list, step-up).
 *
 * Not implemented yet: verifying the signature on the key directory itself,
 * nonce replay protection, and algorithms other than Ed25519. Tested against
 * self-generated keys only — not yet against a real signed agent.
 */
import { createHash, createPublicKey, verify as verifySignature, sign as createSignature } from 'node:crypto';
import { parseDictionary, parseItemValue } from './structured-fields.js';

export const DIRECTORY_PATH = '/.well-known/http-message-signatures-directory';
const DEFAULT_TAG = 'web-bot-auth';

/** RFC 7638 JWK thumbprint for an Ed25519 (OKP) key, base64url — the keyid Web Bot Auth uses. */
export function jwkThumbprint(jwk) {
  return createHash('sha256').update(JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x })).digest('base64url');
}

/** Fetches and caches key directories by origin. Only https agents are accepted. */
export function createDirectoryFetcher({ fetch = globalThis.fetch, ttlMs = 60 * 60 * 1000, timeoutMs = 3000, now = Date.now } = {}) {
  const cache = new Map();
  return async function fetchDirectory(agentUrl) {
    const url = new URL(agentUrl);
    if (url.protocol !== 'https:') throw new Error('signature agent must be an https URL');
    const cached = cache.get(url.origin);
    if (cached && cached.expires > now()) return cached.keys;
    const res = await fetch(`${url.origin}${DIRECTORY_PATH}`, {
      headers: { accept: 'application/http-message-signatures-directory+json, application/json' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`key directory returned HTTP ${res.status}`);
    const body = await res.json();
    const keys = Array.isArray(body?.keys) ? body.keys : [];
    cache.set(url.origin, { keys, expires: now() + ttlMs });
    return keys;
  };
}

const defaultFetchDirectory = createDirectoryFetcher();

/**
 * @param {object} request  { method, url, headers } — url may be a path (then `scheme` and the Host header are used)
 * @returns {Promise<{ present, verified, reason, label?, agent?, keyid?, created?, expires? }>}
 */
export async function verifyWebBotAuth(request, options = {}) {
  const { fetchDirectory = defaultFetchDirectory, now = () => Math.floor(Date.now() / 1000), maxSkewSeconds = 60, tag = DEFAULT_TAG, scheme = 'https' } = options;
  const headers = normaliseHeaders(request.headers);
  if (!headers['signature-input'] || !headers.signature) return { present: false, verified: false, reason: 'no signature' };

  let inputs;
  let signatures;
  try {
    inputs = parseDictionary(headers['signature-input']);
    signatures = parseDictionary(headers.signature);
  } catch (error) {
    return { present: true, verified: false, reason: `malformed signature headers: ${error.message}` };
  }

  const candidates = [...inputs].filter(([, input]) => Array.isArray(input.list) && (!tag || input.params.tag === tag));
  if (!candidates.length) return { present: true, verified: false, reason: `no signature tagged "${tag}"` };

  const [label, input] = candidates[0];
  const params = input.params;
  const result = { present: true, verified: false, label, keyid: params.keyid ?? null, created: params.created ?? null, expires: params.expires ?? null };
  const reject = (reason) => ({ ...result, reason });

  const signature = signatures.get(label)?.value;
  if (!Buffer.isBuffer(signature)) return reject(`no signature value for label "${label}"`);
  if (params.alg !== undefined && params.alg !== 'ed25519') return reject(`unsupported alg "${params.alg}"`);
  const t = now();
  if (typeof params.created !== 'number' || params.created > t + maxSkewSeconds) return reject('missing or future "created"');
  if (typeof params.expires !== 'number' || params.expires < t - maxSkewSeconds) return reject('missing or past "expires"');
  const covered = input.list.map((item) => item.value);
  if (!covered.includes('@authority')) return reject('signature does not cover @authority');

  let agent;
  try {
    agent = signatureAgent(headers, input);
  } catch (error) {
    return reject(error.message);
  }
  result.agent = agent;

  let keys;
  try {
    keys = await fetchDirectory(agent);
  } catch (error) {
    return { ...result, reason: `key directory: ${error.message}` };
  }
  const jwk = keys.find((key) => key?.kty === 'OKP' && key.crv === 'Ed25519' && (key.kid === params.keyid || jwkThumbprint(key) === params.keyid));
  if (!jwk) return { ...result, reason: `keyid not found in ${agent}${DIRECTORY_PATH}` };

  let base;
  try {
    base = signatureBase({ ...request, headers }, input, scheme);
  } catch (error) {
    return { ...result, reason: error.message };
  }
  const publicKey = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: jwk.x }, format: 'jwk' });
  const verified = verifySignature(null, Buffer.from(base), publicKey, signature);
  return { ...result, verified, reason: verified ? 'ok' : 'signature does not match' };
}

/**
 * Signs a request the way a Web Bot Auth agent does. Used by tests and to
 * simulate signed agents against a site; returns the headers to add.
 */
export function signWebBotAuth(request, { privateKey, jwk, agent, label = 'sig1', created = Math.floor(Date.now() / 1000), ttlSeconds = 60, components = ['@authority', 'signature-agent'], nonce, scheme = 'https' }) {
  const headers = { ...normaliseHeaders(request.headers), 'signature-agent': JSON.stringify(agent) };
  const params = [`created=${created}`, `expires=${created + ttlSeconds}`, `keyid="${jwkThumbprint(jwk)}"`, 'alg="ed25519"'];
  if (nonce) params.push(`nonce="${nonce}"`);
  params.push(`tag="${DEFAULT_TAG}"`);
  const inputValue = `(${components.map((c) => JSON.stringify(c)).join(' ')});${params.join(';')}`;
  const input = parseDictionary(`${label}=${inputValue}`).get(label);
  const base = signatureBase({ ...request, headers }, input, scheme);
  const signature = createSignature(null, Buffer.from(base), privateKey).toString('base64');
  return { 'signature-agent': headers['signature-agent'], 'signature-input': `${label}=${inputValue}`, signature: `${label}=:${signature}:` };
}

/** RFC 9421 §2.5 signature base. */
export function signatureBase(request, input, scheme = 'https') {
  const headers = normaliseHeaders(request.headers);
  const lines = input.list.map((item) => `${item.raw}: ${componentValue(request, headers, item, scheme)}`);
  lines.push(`"@signature-params": ${input.raw}`);
  return lines.join('\n');
}

function componentValue(request, headers, item, scheme) {
  const name = item.value;
  if (typeof name !== 'string') throw new Error('component identifiers must be strings');
  if (name.startsWith('@')) return derivedComponent(request, headers, name, scheme);
  const value = headers[name];
  if (value === undefined) throw new Error(`covered header "${name}" is missing`);
  if (item.params.key !== undefined) {
    const member = parseDictionary(value).get(item.params.key);
    if (!member) throw new Error(`dictionary member "${item.params.key}" missing from "${name}"`);
    return member.raw;
  }
  if (Object.keys(item.params).length) throw new Error(`unsupported component parameters on "${name}"`);
  return value;
}

function derivedComponent(request, headers, name, scheme) {
  const target = new URL(request.url ?? '/', `${scheme}://${headers.host ?? 'localhost'}`);
  switch (name) {
    case '@authority':
      return target.host.toLowerCase();
    case '@method':
      return String(request.method ?? 'GET').toUpperCase();
    case '@path':
      return target.pathname;
    case '@query':
      return target.search || '?';
    case '@scheme':
      return target.protocol.replace(':', '');
    case '@target-uri':
      return target.href;
    default:
      throw new Error(`unsupported derived component ${name}`);
  }
}

/** Signature-Agent is an sf-string, or a dictionary whose member is selected by the component's key parameter. */
function signatureAgent(headers, input) {
  const raw = headers['signature-agent'];
  if (!raw) throw new Error('Signature-Agent header missing');
  const component = input.list.find((item) => item.value === 'signature-agent');
  if (!component) throw new Error('signature does not cover signature-agent');
  const value = component.params.key !== undefined ? parseDictionary(raw).get(component.params.key)?.value : parseItemValue(raw).value;
  if (typeof value !== 'string') throw new Error('Signature-Agent is not a URL string');
  return value;
}

function normaliseHeaders(headers = {}) {
  const out = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[name.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value).trim();
  }
  return out;
}
