/**
 * One adapter per automation tool, each mapping the task's verbs onto that
 * tool's idiomatic API. Each `open*` returns { adapter, close }.
 */
import { sleep } from './task.mjs';

const SYSTEM_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SYSTEM_FIREFOX = '/Applications/Firefox.app/Contents/MacOS/firefox';

// The page-side snippets are written as function bodies so Selenium's executeScript can use them too.
const scrape = new Function("return Array.from(document.querySelectorAll('#records td')).map((td) => td.textContent).length;");
const exportFn = (label) => window.antiSmith.exportJSON({ label, exportedFrom: 'harness' });

// ---------------------------------------------------------------- Playwright

export async function openPlaywright({ engine, headless }) {
  const pw = await import('playwright');
  const browser = await pw[engine].launch({ headless });
  const page = await browser.newPage();
  const adapter = {
    goto: (url) => page.goto(url),
    click: (sel) => page.locator(sel).click(),
    type: (sel, text) => page.locator(sel).pressSequentially(text),
    fill: (sel, text) => page.locator(sel).fill(text),
    scrape: () => page.evaluate(scrape),
    exportResults: (label) => page.evaluate(exportFn, label),
    sleep,
  };
  return { adapter, close: () => browser.close() };
}

// ----------------------------------------------------------------- Puppeteer

export async function openPuppeteer({ browser: product = 'chrome', headless, stealth = false }) {
  let launcher;
  if (stealth) {
    const { default: puppeteerExtra } = await import('puppeteer-extra');
    const { default: Stealth } = await import('puppeteer-extra-plugin-stealth');
    puppeteerExtra.use(Stealth());
    launcher = puppeteerExtra;
  } else {
    launcher = (await import('puppeteer')).default;
  }
  const browser = await launcher.launch({
    browser: product,
    headless,
    executablePath: product === 'firefox' ? SYSTEM_FIREFOX : SYSTEM_CHROME,
  });
  const page = await browser.newPage();
  const adapter = {
    goto: (url) => page.goto(url),
    click: (sel) => page.locator(sel).click(),
    type: (sel, text) => page.type(sel, text),
    fill: (sel, text) => page.locator(sel).fill(text),
    scrape: () => page.evaluate(scrape),
    exportResults: (label) => page.evaluate(exportFn, label),
    sleep,
  };
  return { adapter, close: () => browser.close() };
}

// ------------------------------------------------------------------ Selenium

export async function openSelenium({ browser: product, headless }) {
  const { Builder, By } = await import('selenium-webdriver');
  const chrome = await import('selenium-webdriver/chrome.js');
  const firefox = await import('selenium-webdriver/firefox.js');
  const builder = new Builder().forBrowser(product);
  if (product === 'chrome') {
    const options = new chrome.Options().setChromeBinaryPath(SYSTEM_CHROME);
    if (headless) options.addArguments('--headless=new');
    builder.setChromeOptions(options);
  } else {
    const options = new firefox.Options().setBinary(SYSTEM_FIREFOX);
    if (headless) options.addArguments('-headless');
    builder.setFirefoxOptions(options);
  }
  const driver = await builder.build();
  const find = (sel) => driver.findElement(By.css(sel));
  const adapter = {
    goto: (url) => driver.get(url),
    // Selenium scrolls targets to the top edge, under the lab's sticky header; centre them first, as Selenium users do.
    click: async (sel) => {
      const el = await find(sel);
      await driver.executeScript("arguments[0].scrollIntoView({ block: 'center' });", el);
      await el.click();
    },
    type: async (sel, text) => (await find(sel)).sendKeys(text),
    // Selenium has no fill(); scripts commonly set the value and fire input themselves.
    fill: async (sel, text) =>
      driver.executeScript(
        "arguments[0].value = arguments[1]; arguments[0].dispatchEvent(new Event('input', { bubbles: true })); arguments[0].dispatchEvent(new Event('change', { bubbles: true }));",
        await find(sel),
        text,
      ),
    scrape: () => driver.executeScript("return Array.from(document.querySelectorAll('#records td')).map((td) => td.textContent).length;"),
    exportResults: (label) => driver.executeScript('return window.antiSmith.exportJSON({ label: arguments[0], exportedFrom: "harness" });', label),
    sleep,
  };
  return { adapter, close: () => driver.quit() };
}
