/**
 * Lab configuration. Per-plugin settings are merged over each plugin's defaults.
 * Disable a plugin with { enabled: false }, or for one session with ?skip=<id>
 * (comma-separated). Run only some plugins with ?only=<id>,<id>.
 */
export default {
  logLimit: 20000,
  scoring: {
    points: { strong: 40, medium: 15, weak: 5 },
    thresholds: { suspicious: 15, likely: 40 },
  },
  plugins: {
    'responder.on-detected': {
      threshold: 40,
      // Stub hook. Detect-only for now: wire redaction, step-up auth or blocking here later.
      onDetected(result) {
        console.info('[anti-smith] onDetected', result.score, result.contributors.map((c) => c.id));
      },
    },
    'sink.http-log': { endpoint: '/log' },
    'detector.sensitive-reads': { selector: '[data-as-sensitive]' },
    'detector.extension-probe': {
      extensions: [
        {
          name: 'Claude for Chrome',
          // From chrome://extensions, version 1.0.102 (2026-10-24).
          extensionId: 'fcoeoabgfenejglbffodgkkbkcdhcgfn',
          // web_accessible_resources for <all_urls>, use_dynamic_url: false (manifest of 1.0.102).
          // File names carry build hashes and will change with releases; update from the manifest.
          resourcePaths: ['assets/agent-visual-indicator.js-uaVFxZ2f.js', 'assets/accessibility-tree.js-B-oUarrX.js'],
        },
      ],
    },
  },
};
