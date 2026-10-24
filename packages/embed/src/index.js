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
  });
}
