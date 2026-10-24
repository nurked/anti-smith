import { createRuntime } from '../../core/src/index.js';

/**
 * Runs one plugin inside a real runtime with fake browser globals.
 *
 *   const run = await runPlugin(plugin, { window: fakeWindow({ navigator: { webdriver: true } }) });
 *   assert.equal(run.finding().status, 'detected');
 *   run.stop();
 *
 * Always call stop() when the plugin starts timers, or Node will not exit.
 */
export async function runPlugin(plugin, { window = fakeWindow(), document = window.document ?? null, config = {} } = {}) {
  const runtime = createRuntime({
    plugins: [plugin],
    window,
    document,
    config: { plugins: { [plugin.id]: config } },
  });
  await runtime.start();
  return {
    runtime,
    finding: () => runtime.findings().find((finding) => finding.id === plugin.id) ?? null,
    events: (type) => runtime.log.all().filter((e) => e.source === plugin.id && (!type || e.type === type)),
    stop: () => runtime.stop(),
  };
}

/** A minimal window-like object. Pass overrides for whatever the plugin reads. */
export function fakeWindow({ navigator = {}, ...rest } = {}) {
  return {
    navigator: {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      languages: ['en-US', 'en'],
      webdriver: false,
      ...navigator,
    },
    location: { href: 'http://localhost/test' },
    ...rest,
  };
}
