# Agent extension probe — `detector.extension-probe`

Tries to load configured chrome-extension:// resources to see whether known agent extensions are installed.

**Weight:** medium · **Phase:** static

## How it works

Known agent extensions, probed through their web-accessible resources.

Pages cannot list installed extensions. They can try to load
chrome-extension://<id>/<path>; it only succeeds when the extension is
installed and lists that path in web_accessible_resources for this origin.

Ships with a placeholder for Claude for Chrome: fill in the ID and a
web-accessible path (from the extension's manifest) in the lab config.

## Configuration

Override in the host config under `plugins['detector.extension-probe']`. Defaults:

```json
{
  "timeoutMs": 1500,
  "extensions": [
    {
      "name": "Claude for Chrome",
      "extensionId": "",
      "resourcePath": "",
      "note": "TODO: fill in the extension ID and a web_accessible_resources path from its manifest"
    }
  ]
}
```

## Limitations

- Installed is not the same as active: the person may have the extension but not be using it right now.
- Manifest V3 extensions can set use_dynamic_url, which makes resource URLs unguessable; extensions without web-accessible resources cannot be probed.
- Chromium only. Probing installed extensions is device fingerprinting — check consent requirements (ePrivacy/GDPR) before using it in production.

## Test results

Fill in from the runs in [docs/test-plan.md](../../../docs/test-plan.md).

| Run | Result | Export file |
| --- | --- | --- |
| Human, plain Chrome | | |
| Human, DevTools open | | |
| Playwright default | | |
| Playwright + stealth | | |
| Puppeteer | | |
| Claude for Chrome | | |
