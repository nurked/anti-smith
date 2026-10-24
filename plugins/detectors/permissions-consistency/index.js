/**
 * Notification permission consistency. Old headless Chrome reported
 * Notification.permission "denied" while permissions.query said "prompt".
 */
const EXPECTED = { default: 'prompt', granted: 'granted', denied: 'denied' };

export default {
  id: 'detector.permissions-consistency',
  kind: 'detector',
  version: '0.1.0',
  title: 'Notification permission consistency',
  description: 'Compares Notification.permission with navigator.permissions.query({ name: "notifications" }).',
  weight: 'medium',
  evidence: 'environment',
  phase: 'static',
  tags: ['headless', 'fingerprint'],
  limitations: [
    'Fixed in new headless Chrome and patched by stealth plugins.',
    'Some privacy extensions and enterprise policies also produce mismatches.',
  ],

  async start(ctx) {
    const { Notification, navigator } = ctx.window;
    if (!Notification || typeof navigator?.permissions?.query !== 'function') {
      return ctx.report({ status: 'unsupported', evidence: { reason: 'Notification or permissions API missing' } });
    }
    const permission = Notification.permission;
    let state;
    try {
      state = (await navigator.permissions.query({ name: 'notifications' })).state;
    } catch (error) {
      return ctx.report({ status: 'unsupported', evidence: { reason: String(error?.message ?? error) } });
    }
    const evidence = { notificationPermission: permission, queryState: state };
    return ctx.report({ status: EXPECTED[permission] === state ? 'clean' : 'detected', evidence });
  },
};
