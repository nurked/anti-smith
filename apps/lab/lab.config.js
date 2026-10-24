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
          extensionId: '',
          resourcePath: '',
          note: 'TODO: fill in from chrome://extensions (ID) and the manifest (a web_accessible_resources path)',
        },
      ],
    },
  },
};
