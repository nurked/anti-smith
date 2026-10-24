# onDetected hook (stub) — `responder.on-detected`

Calls config.onDetected(score) once each time the score rises past the threshold. Does not block anything.

## How it works

The onDetected(score) hook — a stub.

v0 is detect-only: this responder never blocks, hides or changes anything.
It logs when the score crosses the threshold and calls `config.onDetected`
if the host supplied one. Real responses (redact, step-up auth, notify the
server, block) belong in their own responder plugins — see docs/roadmap.md.

## Configuration

Override in the host config under `plugins['responder.on-detected']`. Defaults:

```json
{
  "threshold": 40,
  "onDetected": null
}
```
