# Agent extension probe — `detector.extension-probe`

Tries to load configured chrome-extension:// resources to see whether known agent extensions are installed.

**Weight:** medium · **Phase:** static

## How it works

Known agent extensions, probed through their web-accessible resources.

Pages cannot list installed extensions. They can try to load
chrome-extension://<id>/<path>; it only succeeds when the extension is
installed and lists that path in web_accessible_resources for this origin.

Ships with Claude for Chrome (1.0.102): it exposes two content-script files
to every site with use_dynamic_url: false. Their names include build hashes,
so `resourcePaths` must be refreshed from the manifest when the extension updates.

## Configuration

Override in the host config under `plugins['detector.extension-probe']`. Defaults:

```json
{
  "timeoutMs": 1500,
  "extensions": [
    {
      "name": "Claude for Chrome",
      "extensionId": "fcoeoabgfenejglbffodgkkbkcdhcgfn",
      "resourcePaths": [
        "assets/agent-visual-indicator.js-uaVFxZ2f.js",
        "assets/accessibility-tree.js-B-oUarrX.js"
      ]
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
| Human, plain Chrome | clean when the extension is not installed; **detected** whenever it is installed, even if idle | |
| Human, DevTools open | | |
| Playwright default | | |
| Playwright + stealth | | |
| Puppeteer | | |
| Claude for Chrome | **detected** in 2 ms (both paths load), 2026-10-24 | |
