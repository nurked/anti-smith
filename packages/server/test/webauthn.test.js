import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import { createStepUp } from '../src/index.js';

const RP_ID = 'localhost';
const ORIGIN = 'http://localhost:8787';
const USER = 'lab-user';

// --- a tiny software authenticator, enough to produce real WebAuthn responses ---

function cbor(value) {
  const head = (major, n) => {
    if (n < 24) return Buffer.from([(major << 5) | n]);
    if (n < 256) return Buffer.from([(major << 5) | 24, n]);
    const b = Buffer.alloc(3);
    b[0] = (major << 5) | 25;
    b.writeUInt16BE(n, 1);
    return b;
  };
  if (Buffer.isBuffer(value)) return Buffer.concat([head(2, value.length), value]);
  if (typeof value === 'string') return Buffer.concat([head(3, Buffer.byteLength(value)), Buffer.from(value)]);
  if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (value instanceof Map) return Buffer.concat([head(5, value.size), ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)])]);
  throw new TypeError('unsupported');
}

function authenticator({ uv = true } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const jwk = publicKey.export({ format: 'jwk' });
  const credentialId = Buffer.from('credential-1');
  const rpIdHash = createHash('sha256').update(RP_ID).digest();
  let counter = 0;
  const flags = (extra) => 0x01 | (uv ? 0x04 : 0) | extra;
  const clientData = (type, challenge, origin = ORIGIN) => Buffer.from(JSON.stringify({ type, challenge, origin }));

  return {
    create(options, origin) {
      const cose = new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]);
      const idLength = Buffer.alloc(2);
      idLength.writeUInt16BE(credentialId.length);
      const authData = Buffer.concat([rpIdHash, Buffer.from([flags(0x40)]), Buffer.alloc(4), Buffer.alloc(16), idLength, credentialId, cbor(cose)]);
      const attestationObject = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
      return {
        id: credentialId.toString('base64url'),
        response: {
          clientDataJSON: clientData('webauthn.create', options.challenge, origin).toString('base64url'),
          attestationObject: attestationObject.toString('base64url'),
        },
      };
    },
    get(options, { origin, counterStep = 1 } = {}) {
      counter += counterStep;
      const count = Buffer.alloc(4);
      count.writeUInt32BE(counter);
      const authData = Buffer.concat([rpIdHash, Buffer.from([flags(0)]), count]);
      const data = clientData('webauthn.get', options.challenge, origin);
      const signature = sign('sha256', Buffer.concat([authData, createHash('sha256').update(data).digest()]), { key: privateKey, dsaEncoding: 'der' });
      return {
        id: credentialId.toString('base64url'),
        response: { clientDataJSON: data.toString('base64url'), authenticatorData: authData.toString('base64url'), signature: signature.toString('base64url') },
      };
    },
  };
}

const registered = (auth = authenticator()) => {
  const stepUp = createStepUp({ rpId: RP_ID, origins: [ORIGIN] });
  const result = stepUp.verifyRegistration(USER, auth.create(stepUp.registrationOptions(USER)));
  assert.equal(result.verified, true, result.reason);
  return { stepUp, auth };
};

test('register, then a user-verified assertion passes', () => {
  const { stepUp, auth } = registered();
  const options = stepUp.assertionOptions(USER);
  assert.equal(options.registered, true);
  const result = stepUp.verifyAssertion(USER, auth.get(options));
  assert.deepEqual([result.verified, result.userVerified], [true, true], result.reason);
});

test('no registered credential means no assertion options', () => {
  const stepUp = createStepUp({ rpId: RP_ID, origins: [ORIGIN] });
  assert.deepEqual(stepUp.assertionOptions(USER), { registered: false });
});

test('a challenge cannot be used twice', () => {
  const { stepUp, auth } = registered();
  const options = stepUp.assertionOptions(USER);
  assert.equal(stepUp.verifyAssertion(USER, auth.get(options)).verified, true);
  const replay = stepUp.verifyAssertion(USER, auth.get(options));
  assert.equal(replay.verified, false);
  assert.match(replay.reason, /reused/);
});

test('an assertion from another origin is rejected', () => {
  const { stepUp, auth } = registered();
  const result = stepUp.verifyAssertion(USER, auth.get(stepUp.assertionOptions(USER), { origin: 'https://evil.example' }));
  assert.equal(result.verified, false);
  assert.match(result.reason, /origin/);
});

test('a different key (e.g. a freshly injected virtual authenticator) cannot pass for the registered credential', () => {
  const { stepUp } = registered();
  const impostor = authenticator();
  const result = stepUp.verifyAssertion(USER, impostor.get(stepUp.assertionOptions(USER)));
  assert.equal(result.verified, false);
  assert.match(result.reason, /signature/);
});

test('user verification is required', () => {
  const stepUp = createStepUp({ rpId: RP_ID, origins: [ORIGIN] });
  const result = stepUp.verifyRegistration(USER, authenticator({ uv: false }).create(stepUp.registrationOptions(USER)));
  assert.equal(result.verified, false);
  assert.match(result.reason, /user verification/);
});

test('a sign counter that goes backwards is rejected', () => {
  const { stepUp, auth } = registered();
  assert.equal(stepUp.verifyAssertion(USER, auth.get(stepUp.assertionOptions(USER), { counterStep: 5 })).verified, true);
  const result = stepUp.verifyAssertion(USER, auth.get(stepUp.assertionOptions(USER), { counterStep: -3 }));
  assert.equal(result.verified, false);
  assert.match(result.reason, /counter/);
});
