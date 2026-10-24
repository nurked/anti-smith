/**
 * Script-tag bootstrap. Add to a page (ideally early in <head>):
 *
 *   <script type="application/json" id="anti-smith-config">
 *     {
 *       "plugins": ["/anti-smith/plugins/detectors/webdriver/index.js", "/anti-smith/plugins/sinks/http-log/index.js"],
 *       "lists": "/anti-smith/api/lists",
 *       "config": { "plugins": { "sink.http-log": { "endpoint": "/anti-smith/log" } } }
 *     }
 *   </script>
 *   <script type="module" src="/anti-smith/packages/embed/src/auto.js"></script>
 *
 * The page receives the narrow handle through a one-time `anti-smith:ready`
 * event on document (for adoptPending/claim). Note that any main-world script
 * can listen for it too; it carries no stop() for that reason.
 */
import { startAntiSmith } from './index.js';

const CONFIG_ID = 'anti-smith-config';

async function boot() {
  const element = document.getElementById(CONFIG_ID);
  if (!element) throw new Error(`anti-smith: no <script id="${CONFIG_ID}"> config found`);
  const { plugins: urls = [], lists: listsUrl = null, config = {} } = JSON.parse(element.textContent);

  const [modules, lists] = await Promise.all([
    Promise.all(urls.map((url) => import(url).then((m) => m.default))),
    listsUrl ? fetch(listsUrl, { credentials: 'same-origin' }).then((res) => (res.ok ? res.json() : {})) : {},
  ]);
  const handle = await startAntiSmith({ plugins: modules, lists, config });
  document.dispatchEvent(new CustomEvent('anti-smith:ready', { detail: handle }));
}

boot().catch((error) => console.error('[anti-smith]', error));
