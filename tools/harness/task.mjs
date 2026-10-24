/**
 * The task every tool performs, so runs are comparable (docs/test-plan.md).
 *
 * `b` is an adapter with: goto(url), click(selector), type(selector, text),
 * fill(selector, text), scrape(), exportResults(label), sleep(ms).
 *   - type  = the tool's key-by-key typing API
 *   - fill  = the tool's "set the value" shortcut (Playwright fill, Puppeteer
 *             locator.fill, Selenium executeScript) — what scrapers actually use
 *   - scrape = read the sensitive table from the page's main world, the way a
 *             scraper does with page.evaluate / executeScript
 */
export const LAB_URL = process.env.LAB_URL ?? 'http://127.0.0.1:8787/apps/lab/';

// Test values for the lab's fake login form; nothing is sent anywhere.
const USERNAME = 'harness-user';
const PASSWORD = 'harness-not-a-password';

export async function runTask(b, label) {
  await b.goto(LAB_URL);
  await b.sleep(1500);
  await b.click('input[name=username]');
  await b.type('input[name=username]', USERNAME);
  await b.fill('input[name=password]', PASSWORD);
  await b.click('#login-form button[type=submit]');
  await b.click('button[data-action=approve]');
  await b.click('button[data-action=delete]');
  await b.click('#notes');
  await b.type('#notes', 'Typed by an automation harness.');
  const cells = await b.scrape();
  await b.click('a[href="#statements"]');
  await b.sleep(3000); // let late detectors and the http-log sink settle
  return { scrapedCells: cells, result: await b.exportResults(label) };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
