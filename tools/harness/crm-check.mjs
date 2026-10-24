#!/usr/bin/env node
/**
 * Visits every Northwind CRM page at every protection level with a headless
 * agent (Playwright), then measures what the agent can still read:
 *   banner   — level-1 banner present
 *   names    — fake contact names still in the page text (of 12)
 *   IDs      — national-ID-shaped values still in the page text
 *   notice   — level-3 notice present, and whether it is the only thing on the page
 *
 * Needs the lab server on http://localhost:8787 (npm start in the repo root).
 */
import { chromium } from 'playwright';
import { contacts } from '../../apps/crm/data.js';

const BASE = process.env.CRM_URL ?? 'http://localhost:8787';
const PAGES = [
  ['dashboard (tag manager)', '/apps/crm/'],
  ['contacts (script tag)', '/apps/crm/contacts.html'],
  ['contact (ES module)', '/apps/crm/contact.html?id=4'],
  ['deals (SPA)', '/apps/crm/deals.html'],
  ['tickets (edge-injected)', '/crm-edge/tickets.html'],
  ['tickets (origin, no anti-smith)', '/apps/crm/tickets.html'],
];
const NAMES = contacts.map((c) => c.name);

const browser = await chromium.launch({ headless: true });
const rows = [];
try {
  for (const [label, path] of PAGES) {
    for (const level of [0, 1, 2, 3]) {
      const context = await browser.newContext(); // fresh storage: the level comes from the query only
      const page = await context.newPage();
      const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}level=${level}`;
      await page.goto(url);
      await page.waitForTimeout(3000);
      const seen = await page.evaluate((names) => {
        const text = document.body.innerText;
        const notice = document.querySelector('[data-as-notice]');
        return {
          banner: Boolean(document.querySelector('[data-as-banner]')),
          names: names.filter((n) => text.includes(n)).length,
          ids: (text.match(/\b000-\d{2}-\d{4}\b/g) ?? []).length,
          notice: Boolean(notice),
          onlyNotice: Boolean(notice) && document.body.children.length === 1,
          title: document.title,
        };
      }, NAMES);
      rows.push({ label, level, ...seen });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

// The way back for a person: at level 3, "I am a person — verify" runs WebAuthn step-up and restores
// the page. Played here with a CDP virtual authenticator; the lab allows on-demand registration, which
// is exactly why a real site must not (ADR 0005).
const verifyBrowser = await chromium.launch({ headless: true });
let human;
try {
  const context = await verifyBrowser.newContext();
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: { protocol: 'ctap2', transport: 'internal', hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  });
  await page.goto(`${BASE}/apps/crm/contact.html?id=4&level=3`);
  await page.locator('[data-as-notice] button').click({ timeout: 10000 });
  await page.waitForTimeout(3000);
  human = await page.evaluate(() => ({
    notice: Boolean(document.querySelector('[data-as-notice]')),
    nameVisible: document.body.innerText.includes('Morgan Testcase'),
    title: document.title,
  }));
  await context.close();
} finally {
  await verifyBrowser.close();
}

const yes = (v) => (v ? 'yes' : '·');
console.log('| Page | Level | Banner | Names readable | IDs readable | Notice | Only the notice | Title |');
console.log('| --- | :-: | :-: | :-: | :-: | :-: | :-: | --- |');
for (const r of rows) {
  console.log(`| ${r.label} | ${r.level} | ${yes(r.banner)} | ${r.names} | ${r.ids} | ${yes(r.notice)} | ${yes(r.onlyNotice)} | ${r.title} |`);
}
console.log(`\nVerify path (contact page, level 3, WebAuthn step-up): notice ${human.notice ? 'still shown' : 'gone'}, content ${human.nameVisible ? 'restored' : 'still hidden'}, title "${human.title}"`);
