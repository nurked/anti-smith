/**
 * Lab configuration. Per-plugin settings are merged over each plugin's defaults.
 * Disable a plugin with { enabled: false }, or for one session with ?skip=<id>
 * (comma-separated). Run only some plugins with ?only=<id>,<id>. Turn on opt-in
 * responders with ?enable=<id>,<id>.
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
    // Opt-in responders (ADR 0005). Turn on with ?enable=responder.redact,responder.step-up
    'responder.redact': { mode: 'on-score', threshold: 40, requireStepUp: true },
    // Lab only: lets the first reveal register a passkey. Use http://localhost:8787 (WebAuthn rejects IP addresses).
    'responder.step-up': { allowRegistration: true },
    'detector.sensitive-reads': { selector: '[data-as-sensitive]' },
  },
};
