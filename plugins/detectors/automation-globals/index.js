/**
 * Globals and DOM markers left behind by automation frameworks.
 *
 * Some appear only after the framework starts using a feature (Playwright adds
 * `__playwright__binding__` on exposeBinding), so the check repeats for a while.
 */
export default {
  id: 'detector.automation-globals',
  kind: 'detector',
  version: '0.1.0',
  title: 'Automation framework globals',
  description: 'Looks for window/document properties and attributes injected by Playwright, Puppeteer, ChromeDriver/Selenium, PhantomJS and Nightmare.',
  weight: 'strong',
  evidence: 'deterministic',
  phase: 'static',
  tags: ['automation', 'playwright', 'puppeteer', 'selenium'],
  lists: { names: 'automation-globals.names', prefixes: 'automation-globals.prefixes', documentAttributes: 'automation-globals.documentAttributes' },
  limitations: [
    'Only sees the main world: anything a framework keeps in an isolated world (Playwright utility world, extension content scripts) is invisible.',
    'Patched ChromeDriver builds rename the cdc_ variables; stealth tooling removes the rest.',
    '__puppeteer_evaluation_script__ is normally a sourceURL in stack traces, not a global — see detector.sensitive-reads for stack markers.',
  ],
  defaults: {
    names: [
      '__playwright__binding__',
      '__pwInitScripts',
      '__puppeteer_evaluation_script__',
      '_selenium',
      'callSelenium',
      '_Selenium_IDE_Recorder',
      '__webdriver_evaluate',
      '__selenium_evaluate',
      '__webdriver_script_function',
      '__webdriver_script_func',
      '__webdriver_script_fn',
      '__fxdriver_evaluate',
      '__driver_unwrapped',
      '__webdriver_unwrapped',
      '__driver_evaluate',
      '__selenium_unwrapped',
      '__fxdriver_unwrapped',
      '_WEBDRIVER_ELEM_CACHE',
      'callPhantom',
      '_phantom',
      '__nightmare',
      'domAutomation',
      'domAutomationController',
    ],
    prefixes: ['cdc_', '$cdc_', '$wdc_', '__playwright', '__pw_', '__puppeteer', '__selenium', '__webdriver', '__nightmare'],
    documentAttributes: ['webdriver', 'selenium', 'driver'],
    pollMs: 2000,
    pollForMs: 60000,
  },

  start(ctx) {
    const { window: win, document: doc, config } = ctx;
    const found = new Set();

    const check = () => {
      for (const name of config.names) if (name in win) found.add(`window.${name}`);
      for (const key of safeKeys(() => Object.getOwnPropertyNames(win))) {
        if (config.prefixes.some((prefix) => key.startsWith(prefix))) found.add(`window.${key}`);
      }
      if (doc) {
        for (const key of safeKeys(() => Object.keys(doc))) {
          if (config.prefixes.some((prefix) => key.startsWith(prefix))) found.add(`document.${key}`);
        }
        for (const attr of config.documentAttributes) {
          if (doc.documentElement?.hasAttribute?.(attr)) found.add(`<html ${attr}>`);
        }
      }
      return [...found];
    };

    const publish = () => {
      const markers = check();
      ctx.report(
        markers.length
          ? { status: 'detected', evidence: { markers } }
          : { status: 'clean', evidence: { checkedNames: config.names.length, prefixes: config.prefixes } },
      );
      return markers.length;
    };

    let last = publish();
    if (config.pollForMs > 0) {
      const until = ctx.now() + config.pollForMs;
      ctx.every(config.pollMs, () => {
        if (ctx.now() > until) return;
        const count = check().length;
        if (count !== last) {
          last = publish();
          ctx.log('late-marker', { markers: [...found] });
        }
      });
    }
  },
};

function safeKeys(read) {
  try {
    return read();
  } catch {
    return [];
  }
}
