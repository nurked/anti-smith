import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { verifyWebBotAuth, signWebBotAuth, jwkThumbprint, parseDictionary } from '../src/index.js';

const AGENT = 'https://agent.example';
const NOW = 1_790_000_000;

function setup() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const jwk = publicKey.export({ format: 'jwk' });
  const request = { method: 'GET', url: '/records', headers: { host: 'bank.example', 'user-agent': 'TestAgent/1.0' } };
  const fetchDirectory = async (agent) => {
    assert.equal(agent, AGENT);
    return [{ ...jwk, kid: jwkThumbprint(jwk) }];
  };
  const sign = (overrides = {}) => ({
    ...request,
    headers: { ...request.headers, ...signWebBotAuth(request, { privateKey, jwk, agent: AGENT, created: NOW, ...overrides }) },
  });
  return { sign, fetchDirectory, jwk };
}

const options = (fetchDirectory) => ({ fetchDirectory, now: () => NOW + 5 });

test('a correctly signed request verifies and names the agent', async () => {
  const { sign, fetchDirectory, jwk } = setup();
  const result = await verifyWebBotAuth(sign(), options(fetchDirectory));
  assert.equal(result.verified, true, result.reason);
  assert.equal(result.agent, AGENT);
  assert.equal(result.keyid, jwkThumbprint(jwk));
});

test('unsigned requests are reported as not present', async () => {
  const { fetchDirectory } = setup();
  const result = await verifyWebBotAuth({ method: 'GET', url: '/', headers: { host: 'bank.example' } }, options(fetchDirectory));
  assert.deepEqual([result.present, result.verified], [false, false]);
});

test('a different authority breaks the signature', async () => {
  const { sign, fetchDirectory } = setup();
  const signed = sign();
  signed.headers.host = 'evil.example';
  const result = await verifyWebBotAuth(signed, options(fetchDirectory));
  assert.equal(result.verified, false);
  assert.equal(result.reason, 'signature does not match');
});

test('expired signatures are rejected before any key lookup', async () => {
  const { sign } = setup();
  const result = await verifyWebBotAuth(sign({ ttlSeconds: 10 }), { fetchDirectory: () => assert.fail('no lookup'), now: () => NOW + 3600 });
  assert.equal(result.verified, false);
  assert.match(result.reason, /expires/);
});

test('a key missing from the directory is rejected', async () => {
  const { sign } = setup();
  const other = generateKeyPairSync('ed25519').publicKey.export({ format: 'jwk' });
  const result = await verifyWebBotAuth(sign(), { fetchDirectory: async () => [other], now: () => NOW });
  assert.equal(result.verified, false);
  assert.match(result.reason, /keyid not found/);
});

test('signatures without the web-bot-auth tag are ignored', async () => {
  const { sign, fetchDirectory } = setup();
  const signed = sign();
  signed.headers['signature-input'] = signed.headers['signature-input'].replace('tag="web-bot-auth"', 'tag="other"');
  const result = await verifyWebBotAuth(signed, options(fetchDirectory));
  assert.equal(result.verified, false);
  assert.match(result.reason, /no signature tagged/);
});

test('signature-input keeps the raw serialisation needed for the signature base', () => {
  const dict = parseDictionary('sig1=("@authority" "signature-agent";key="a1");created=1;keyid="k";tag="web-bot-auth"');
  const member = dict.get('sig1');
  assert.equal(member.raw, '("@authority" "signature-agent";key="a1");created=1;keyid="k";tag="web-bot-auth"');
  assert.equal(member.list[1].raw, '"signature-agent";key="a1"');
  assert.equal(member.params.tag, 'web-bot-auth');
});
