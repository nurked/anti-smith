/**
 * Start anti-smith on a page and get back a narrow handle.
 *
 *   import { startAntiSmith } from '@anti-smith/embed';
 *   import webdriver from '.../plugins/detectors/webdriver/index.js';
 *   const antiSmith = await startAntiSmith({ plugins: [webdriver, ...], lists, config });
 *   antiSmith.onScore((result) => ...);
 *
 * Unlike the lab, nothing is put on `window`: the full runtime (with stop(),
 * the event log and the registry) stays private to the caller. Main-world
 * scripts can still tamper with the page — hardening is a roadmap item — but
 * there is no ready-made switch for them to turn off.
 */
import { createRuntime } from '../../core/src/index.js';

export async function startAntiSmith({ plugins, config = {}, lists = {}, scorer } = {}) {
  const runtime = createRuntime({ plugins, config, lists, scorer });
  await runtime.start();
  return handleFor(runtime);
}

/** The subset of the runtime a host page needs. */
export function handleFor(runtime) {
  return Object.freeze({
    sessionId: runtime.sessionId,
    score: () => runtime.score(),
    onScore: (fn) => runtime.onChange((snapshot) => fn(snapshot.score)),
    claim: (node) => runtime.claim(node),
    adoptPending: () => runtime.adoptPending(),
    /**
     * Engage protection now, whatever the score: one protection responder by id
     * (e.g. 'responder.lockout'), or all of them when omitted. Only ever makes
     * protection stronger; there is deliberately no host call that unlocks.
     */
    trigger: (responder = null) => runtime.emit('protection-trigger', { responder }),
    /**
     * Run WebAuthn step-up (responder.step-up must be loaded). On a page whose
     * step-up config allows registration — e.g. account settings, behind login —
     * this is how a person sets up the passkey that later unlocks protected pages.
     * Resolves to { verified, reason }; it never unlocks anything by itself.
     */
    stepUp: (reason = 'host') => {
      const stepUp = runtime.service('step-up');
      return stepUp ? stepUp(reason) : Promise.resolve({ verified: false, reason: 'responder.step-up is not loaded' });
    },
  });
}
