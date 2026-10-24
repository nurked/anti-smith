/**
 * navigator.webdriver — the flag browsers raise when WebDriver, CDP-launched
 * automation (Playwright, Puppeteer) or `--enable-automation` controls them.
 */
export default {
  id: 'detector.webdriver',
  kind: 'detector',
  version: '0.1.0',
  title: 'navigator.webdriver flag',
  description: 'Reports navigator.webdriver === true, and Chromium browsers where the property has been deleted (a stealth-plugin habit).',
  weight: 'strong',
  phase: 'static',
  tags: ['automation', 'webdriver', 'stealth'],
  limitations: [
    'Hidden by stealth plugins and by launching Chromium with --disable-blink-features=AutomationControlled.',
    'Extension agents (e.g. Claude for Chrome) run in a normal profile and never set it.',
  ],

  start(ctx) {
    const nav = ctx.window.navigator;
    if (!nav) return ctx.report({ status: 'unsupported', evidence: { reason: 'no navigator' } });

    const value = nav.webdriver;
    const present = 'webdriver' in nav;
    const chromium = /\b(?:Chrome|Chromium)\/\d+/.test(nav.userAgent ?? '');

    if (value === true) {
      return ctx.report({ status: 'detected', evidence: { webdriver: true } });
    }
    // Every current Chromium exposes navigator.webdriver (false for people). Missing means someone removed it.
    if (chromium && !present) {
      return ctx.report({
        status: 'suspicious',
        evidence: { webdriver: value, present, note: 'property removed — typical of stealth patches' },
      });
    }
    return ctx.report({ status: 'clean', evidence: { webdriver: value ?? null, present } });
  },
};
