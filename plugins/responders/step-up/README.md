# Step-up (WebAuthn) — `responder.step-up`

Provides a "step-up" service that asks for Touch ID / Windows Hello / security-key verification and has the server verify the assertion.

## How it works

Step-up with WebAuthn user verification, checked on the server
(@anti-smith/server createStepUp). Provides the "step-up" service:

  const verify = ctx.service('step-up');
  const { verified } = await verify('reveal');

Opt-in (ADR 0005). WebAuthn needs a secure context and a real domain:
http://localhost works, http://127.0.0.1 does not.

## Configuration

Override in the host config under `plugins['responder.step-up']`. Defaults:

```json
{
  "enabled": false,
  "basePath": "/api/step-up/",
  "allowRegistration": false
}
```
