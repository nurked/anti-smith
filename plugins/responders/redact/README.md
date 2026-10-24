# Redact sensitive values — `responder.redact`

Removes the text of sensitive fields from the DOM (always, or once the score crosses a threshold) and reveals one field at a time on a trusted click or key press, optionally behind step-up.

## How it works

Hides sensitive values until a person reveals them, one field at a time.

Values are removed from the DOM (kept only in this plugin's memory), so
agents reading the DOM, the accessibility tree or the page text get the mask,
not the data. A trusted click or Enter/Space on a field reveals it for a
while, then it hides again. With `requireStepUp`, each reveal also needs
WebAuthn user verification through the "step-up" service.

Opt-in (ADR 0005). Without step-up, a CDP-driven agent can still click to
reveal fields — one at a time, each one logged — so pair it with step-up on
the most sensitive pages.

## Configuration

Override in the host config under `plugins['responder.redact']`. Defaults:

```json
{
  "enabled": false,
  "selector": "[data-as-sensitive]",
  "fieldSelector": "td",
  "mode": "on-score",
  "threshold": 40,
  "mask": "••••••",
  "revealMs": 15000,
  "requireStepUp": false
}
```
