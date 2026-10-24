# Content lockout (protection level 2) — `responder.lockout`

Detaches protected regions from the DOM when the session looks automated; a person restores them through WebAuthn step-up.

## How it works

Protection level 2 — turn the content off.

Once the session looks automated, the content of every protected region
(`[data-as-protected]`, typically <main>) is detached from the document and
kept only in memory. Agents reading the DOM, the accessibility tree, the page
text or a screenshot get a placeholder. A person gets it back with a trusted
click on "verify" plus WebAuthn step-up (responder.step-up); without step-up
on the page, there is no way back except reloading as a person.

Manual trigger: a `protection-trigger` host event (handle.trigger(), e.g. the CRM's
test controls) engages it at once, regardless of level and threshold. Only
`human-verified` events sent by a protection responder can undo it — never host events.

## Configuration

Override in the host config under `plugins['responder.lockout']`. Defaults:

```json
{
  "enabled": false,
  "minLevel": 2,
  "level": null,
  "levelAttribute": "data-as-protection",
  "threshold": 40,
  "thresholdAttribute": "data-as-threshold",
  "selector": "[data-as-protected]",
  "title": "Content hidden",
  "message": "This content is hidden because this session looks automated. It is meant to be used by a person.",
  "verifyLabel": "I am a person — verify to continue",
  "noVerifyMessage": "Verification is not available on this page. Reload it, or contact support if this keeps happening."
}
```
