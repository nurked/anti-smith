/**
 * Step-up with WebAuthn user verification, checked on the server
 * (@anti-smith/server createStepUp). Provides the "step-up" service:
 *
 *   const verify = ctx.service('step-up');
 *   const { verified } = await verify('reveal');
 *
 * Opt-in (ADR 0005). WebAuthn needs a secure context and a real domain:
 * http://localhost works, http://127.0.0.1 does not.
 */
export default {
  id: 'responder.step-up',
  kind: 'responder',
  version: '0.1.0',
  title: 'Step-up (WebAuthn)',
  description: 'Provides a "step-up" service that asks for Touch ID / Windows Hello / security-key verification and has the server verify the assertion.',
  tags: ['webauthn', 'step-up', 'friction'],
  // allowRegistration lets the lab register a passkey on first use. Never enable it on a real site:
  // an agent could register its own virtual authenticator inside the suspicious session.
  defaults: { enabled: false, basePath: '/api/step-up/', allowRegistration: false },

  start(ctx) {
    const { window: win, config } = ctx;
    if (!win.PublicKeyCredential || !win.navigator?.credentials) {
      ctx.log('unsupported', { reason: 'WebAuthn is not available in this context' });
      return;
    }
    const post = (path, body) =>
      win
        .fetch(`${config.basePath}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: ctx.sessionId, ...body }) })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))));

    ctx.provide('step-up', async (reason = 'step-up') => {
      try {
        let options = await post('assert/options');
        if (!options.registered) {
          if (!config.allowRegistration) return finish(ctx, reason, { verified: false, reason: 'no registered credential' });
          const created = await win.navigator.credentials.create({ publicKey: creationOptions(await post('register/options')) });
          const registration = await post('register/verify', { credential: encodeCredential(created) });
          if (!registration.verified) return finish(ctx, reason, registration);
          options = await post('assert/options');
        }
        const assertion = await win.navigator.credentials.get({ publicKey: requestOptions(options) });
        return finish(ctx, reason, await post('assert/verify', { credential: encodeCredential(assertion) }));
      } catch (error) {
        // NotAllowedError: the person cancelled or timed out.
        return finish(ctx, reason, { verified: false, reason: String(error?.name ?? error?.message ?? error) });
      }
    });
  },

  onScore() {},
};

function finish(ctx, reason, result) {
  ctx.log('step-up', { for: reason, verified: Boolean(result.verified), reason: result.reason ?? null });
  return { verified: Boolean(result.verified), reason: result.reason ?? null };
}

function creationOptions(o) {
  return {
    ...o,
    challenge: fromB64url(o.challenge),
    user: { ...o.user, id: fromB64url(o.user.id) },
    excludeCredentials: (o.excludeCredentials ?? []).map((c) => ({ ...c, id: fromB64url(c.id) })),
  };
}

function requestOptions(o) {
  return {
    challenge: fromB64url(o.challenge),
    rpId: o.rpId,
    allowCredentials: o.allowCredentials.map((c) => ({ ...c, id: fromB64url(c.id) })),
    userVerification: o.userVerification,
    timeout: o.timeout,
  };
}

function encodeCredential(credential) {
  const r = credential.response;
  const response = { clientDataJSON: toB64url(r.clientDataJSON) };
  for (const key of ['attestationObject', 'authenticatorData', 'signature', 'userHandle']) {
    if (r[key]) response[key] = toB64url(r[key]);
  }
  return { id: credential.id, rawId: toB64url(credential.rawId), type: credential.type, response };
}

function toB64url(buffer) {
  let binary = '';
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(value) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0)).buffer;
}
