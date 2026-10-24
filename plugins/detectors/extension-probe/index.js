/**
 * Known agent extensions, probed through their web-accessible resources.
 *
 * Pages cannot list installed extensions. They can try to load
 * chrome-extension://<id>/<path>; it only succeeds when the extension is
 * installed and lists that path in web_accessible_resources for this origin.
 *
 * Ships with a placeholder for Claude for Chrome: fill in the ID and a
 * web-accessible path (from the extension's manifest) in the lab config.
 */
const IMAGE_PATH = /\.(?:png|jpe?g|gif|svg|webp|ico)$/i;

export default {
  id: 'detector.extension-probe',
  kind: 'detector',
  version: '0.1.0',
  title: 'Agent extension probe',
  description: 'Tries to load configured chrome-extension:// resources to see whether known agent extensions are installed.',
  weight: 'medium',
  phase: 'static',
  tags: ['extension', 'fingerprint'],
  limitations: [
    'Installed is not the same as active: the person may have the extension but not be using it right now.',
    'Manifest V3 extensions can set use_dynamic_url, which makes resource URLs unguessable; extensions without web-accessible resources cannot be probed.',
    'Chromium only. Probing installed extensions is device fingerprinting — check consent requirements (ePrivacy/GDPR) before using it in production.',
  ],
  defaults: {
    timeoutMs: 1500,
    extensions: [
      {
        name: 'Claude for Chrome',
        extensionId: '',
        resourcePath: '',
        note: 'TODO: fill in the extension ID and a web_accessible_resources path from its manifest',
      },
    ],
  },

  async start(ctx) {
    const { window: win, config } = ctx;
    if (!/\b(?:Chrome|Chromium)\//.test(win.navigator?.userAgent ?? '')) {
      return ctx.report({ status: 'unsupported', evidence: { reason: 'not a Chromium browser' } });
    }
    const entries = config.extensions ?? [];
    const ready = entries.filter((e) => e.extensionId && e.resourcePath);
    const placeholders = entries.filter((e) => !e.extensionId || !e.resourcePath).map((e) => e.name);

    if (!ready.length) {
      return ctx.report({ status: 'clean', evidence: { probed: 0, placeholders, note: 'no extension IDs configured yet' } });
    }
    const results = await Promise.all(ready.map((entry) => probe(win, entry, config.timeoutMs)));
    for (const result of results) ctx.log('probe', result);
    const found = results.filter((r) => r.loaded).map((r) => r.name);
    return ctx.report({ status: found.length ? 'detected' : 'clean', evidence: { found, results, placeholders } });
  },
};

async function probe(win, { name, extensionId, resourcePath }, timeoutMs) {
  const url = `chrome-extension://${extensionId}/${resourcePath.replace(/^\//, '')}`;
  const method = IMAGE_PATH.test(resourcePath) ? 'image' : 'fetch';
  const started = Date.now();
  const loaded = await withTimeout(method === 'image' ? loadImage(win, url) : loadFetch(win, url), timeoutMs);
  return { name, extensionId, url, method, loaded, ms: Date.now() - started };
}

function loadImage(win, url) {
  return new Promise((resolve) => {
    const img = new win.Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

function loadFetch(win, url) {
  return win.fetch(url, { cache: 'no-store' }).then((res) => res.ok, () => false);
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve(false), ms))]);
}
