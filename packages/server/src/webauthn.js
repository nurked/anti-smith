/**
 * WebAuthn step-up: proof that a person is present and verified (Touch ID,
 * Windows Hello, a security key PIN) before a sensitive value is revealed.
 *
 * Server-side verification is the point: an agent controlling the browser can
 * inject a *virtual* authenticator through CDP, but it cannot sign with the
 * person's real, previously registered credential. Therefore registration must
 * happen outside suspicious sessions (account setup, a low-score session);
 * `allowRegistration` exists for the lab.
 *
 * Supports "none" attestation, ES256 and EdDSA credentials, user verification
 * required, single-use challenges, sign-counter regression checks.
 */
import { createHash, createPublicKey, randomBytes, verify as verifySignature } from 'node:crypto';
import { decodeCbor } from './cbor.js';

const FLAG_UP = 0x01;
const FLAG_UV = 0x04;
const FLAG_AT = 0x40;
const ALG = { ES256: -7, EdDSA: -8 };

/** In-memory credential store; production swaps in a database with the same shape. */
export function createCredentialStore() {
  const byUser = new Map();
  return {
    list: (userId) => byUser.get(userId) ?? [],
    add(userId, credential) {
      byUser.set(userId, [...(byUser.get(userId) ?? []).filter((c) => c.id !== credential.id), credential]);
    },
    update(userId, id, patch) {
      const credential = (byUser.get(userId) ?? []).find((c) => c.id === id);
      if (credential) Object.assign(credential, patch);
    },
  };
}

export function createStepUp({ rpId, rpName = 'anti-smith', origins, store = createCredentialStore(), challengeTtlMs = 2 * 60 * 1000, timeoutMs = 60 * 1000, now = Date.now }) {
  if (!rpId || !Array.isArray(origins) || !origins.length) throw new TypeError('createStepUp needs rpId and origins');
  const challenges = new Map();
  const rpIdHash = createHash('sha256').update(rpId).digest();

  function issue(userId, type) {
    const challenge = randomBytes(32).toString('base64url');
    challenges.set(challenge, { userId, type, expires: now() + challengeTtlMs });
    for (const [key, entry] of challenges) if (entry.expires < now()) challenges.delete(key);
    return challenge;
  }

  /** Single use: a challenge is consumed by the first verification attempt, valid or not. */
  function consume(challenge, userId, type) {
    const entry = challenges.get(challenge);
    challenges.delete(challenge);
    if (!entry || entry.userId !== userId || entry.type !== type) throw new Error('unknown or reused challenge');
    if (entry.expires < now()) throw new Error('challenge expired');
  }

  function checkClientData(clientDataB64, userId, type) {
    const raw = fromB64url(clientDataB64);
    const data = JSON.parse(raw.toString('utf8'));
    if (data.type !== type) throw new Error(`clientData type is ${data.type}, expected ${type}`);
    if (!origins.includes(data.origin)) throw new Error(`origin ${data.origin} is not allowed`);
    consume(data.challenge, userId, type);
    return raw;
  }

  function parseAuthData(authData) {
    if (authData.length < 37) throw new Error('authenticatorData too short');
    const flags = authData[32];
    const parsed = {
      rpIdHash: authData.subarray(0, 32),
      flags,
      userPresent: Boolean(flags & FLAG_UP),
      userVerified: Boolean(flags & FLAG_UV),
      signCount: authData.readUInt32BE(33),
    };
    if (!parsed.rpIdHash.equals(rpIdHash)) throw new Error('rpIdHash does not match this relying party');
    if (!parsed.userPresent) throw new Error('user presence flag not set');
    if (!parsed.userVerified) throw new Error('user verification flag not set');
    if (flags & FLAG_AT) {
      const idLength = authData.readUInt16BE(53);
      parsed.credentialId = authData.subarray(55, 55 + idLength);
      parsed.coseKey = decodeCbor(authData.subarray(55 + idLength)).value;
    }
    return parsed;
  }

  return {
    registrationOptions(userId, userName = userId) {
      return {
        challenge: issue(userId, 'webauthn.create'),
        rp: { id: rpId, name: rpName },
        user: { id: Buffer.from(userId).toString('base64url'), name: userName, displayName: userName },
        pubKeyCredParams: [
          { type: 'public-key', alg: ALG.ES256 },
          { type: 'public-key', alg: ALG.EdDSA },
        ],
        authenticatorSelection: { userVerification: 'required', residentKey: 'preferred' },
        excludeCredentials: store.list(userId).map((c) => ({ type: 'public-key', id: c.id })),
        attestation: 'none',
        timeout: timeoutMs,
      };
    },

    verifyRegistration(userId, credential) {
      try {
        checkClientData(credential.response.clientDataJSON, userId, 'webauthn.create');
        const attestation = decodeCbor(fromB64url(credential.response.attestationObject)).value;
        const auth = parseAuthData(attestation.get('authData'));
        if (!auth.coseKey) throw new Error('no attested credential data');
        const { jwk, alg } = coseToJwk(auth.coseKey);
        const id = auth.credentialId.toString('base64url');
        store.add(userId, { id, jwk, alg, signCount: auth.signCount, createdAt: new Date(now()).toISOString() });
        return { verified: true, credentialId: id };
      } catch (error) {
        return { verified: false, reason: error.message };
      }
    },

    assertionOptions(userId) {
      const credentials = store.list(userId);
      if (!credentials.length) return { registered: false };
      return {
        registered: true,
        challenge: issue(userId, 'webauthn.get'),
        rpId,
        allowCredentials: credentials.map((c) => ({ type: 'public-key', id: c.id })),
        userVerification: 'required',
        timeout: timeoutMs,
      };
    },

    verifyAssertion(userId, credential) {
      try {
        const stored = store.list(userId).find((c) => c.id === credential.id);
        if (!stored) throw new Error('credential is not registered for this user');
        const clientData = checkClientData(credential.response.clientDataJSON, userId, 'webauthn.get');
        const authData = fromB64url(credential.response.authenticatorData);
        const auth = parseAuthData(authData);
        const signed = Buffer.concat([authData, createHash('sha256').update(clientData).digest()]);
        const key = createPublicKey({ key: stored.jwk, format: 'jwk' });
        const signature = fromB64url(credential.response.signature);
        const ok =
          stored.alg === ALG.EdDSA
            ? verifySignature(null, signed, key, signature)
            : verifySignature('sha256', signed, { key, dsaEncoding: 'der' }, signature);
        if (!ok) throw new Error('signature does not match');
        if ((auth.signCount || stored.signCount) && auth.signCount <= stored.signCount) throw new Error('sign counter did not increase (cloned authenticator?)');
        store.update(userId, stored.id, { signCount: auth.signCount, lastUsedAt: new Date(now()).toISOString() });
        return { verified: true, userVerified: auth.userVerified, credentialId: stored.id };
      } catch (error) {
        return { verified: false, reason: error.message };
      }
    },
  };
}

/** COSE_Key (RFC 9053) → JWK for node:crypto. */
export function coseToJwk(cose) {
  const kty = cose.get(1);
  const alg = cose.get(3);
  if (kty === 2 && cose.get(-1) === 1) {
    return { alg: alg ?? ALG.ES256, jwk: { kty: 'EC', crv: 'P-256', x: Buffer.from(cose.get(-2)).toString('base64url'), y: Buffer.from(cose.get(-3)).toString('base64url') } };
  }
  if (kty === 1 && cose.get(-1) === 6) {
    return { alg: alg ?? ALG.EdDSA, jwk: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(cose.get(-2)).toString('base64url') } };
  }
  throw new Error(`unsupported credential key (kty ${kty}, crv ${cose.get(-1)})`);
}

function fromB64url(value) {
  if (typeof value !== 'string') throw new Error('expected a base64url string');
  return Buffer.from(value, 'base64url');
}
