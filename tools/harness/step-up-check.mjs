#!/usr/bin/env node
/**
 * End-to-end check of responder.redact + responder.step-up, played by an agent
 * that injects a virtual WebAuthn authenticator through CDP (what an extension
 * with the `debugger` permission could do).
 *
 *   1. Lab mode (allowRegistration on): the agent registers its own virtual
 *      passkey and reveals a field — showing why on-demand registration must
 *      stay off on real sites.
 *   2. A second agent with a fresh virtual authenticator, once a credential is
 *      registered: it cannot assert for that credential, so the reveal is refused.
 *
 * Needs the lab on http://localhost:8787 started *fresh* (credentials live in memory).
 */
import { chromium } from 'playwright';

const URL = 'http://localhost:8787/apps/lab/?enable=responder.redact,responder.step-up&skip=detector.debugger-timing';

async function agentWithVirtualAuthenticator(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  });
  await page.goto(URL);
  // headless Chromium + webdriver push the score past the threshold at once; wait for redaction.
  await page.waitForSelector('#records td[data-as-masked]', { timeout: 10000 });
  return { context, page };
}

async function tryReveal(page) {
  const cell = page.locator('#records tbody tr:first-child td:nth-child(3)');
  await cell.click();
  await page.waitForTimeout(2500);
  const text = await cell.evaluate((td) => td.textContent);
  const log = await page.evaluate(() =>
    window.antiSmith.log
      .all()
      .filter((e) => ['responder.step-up', 'responder.redact'].includes(e.source))
      .map((e) => `${e.type} ${JSON.stringify(e.data)}`),
  );
  return { text, log };
}

const browser = await chromium.launch({ headless: true });
try {
  const first = await agentWithVirtualAuthenticator(browser);
  const a = await tryReveal(first.page);
  console.log('1. agent registers its own passkey (lab mode):', a.text === '••••••' ? 'still hidden' : `REVEALED "${a.text}"`);
  for (const line of a.log) console.log('   ', line);
  await first.context.close();

  const second = await agentWithVirtualAuthenticator(browser);
  const b = await tryReveal(second.page);
  console.log('2. new agent, fresh virtual authenticator, credential already registered:', b.text === '••••••' ? 'still hidden' : `REVEALED "${b.text}"`);
  for (const line of b.log) console.log('   ', line);
  await second.context.close();
} finally {
  await browser.close();
}
