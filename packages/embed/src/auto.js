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
 * A shared site-wide config can live in a file instead: give the block a
 * `data-src` URL. Its JSON is loaded first, then the inline JSON (if any) is
 * merged over it, so a page can override single settings:
 *
 *   <script type="application/json" id="anti-smith-config" data-src="/anti-smith.json">{}</script>
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
  const inline = element.textContent.trim() ? JSON.parse(element.textContent) : {};
  const shared = element.dataset.src ? await fetch(element.dataset.src, { credentials: 'same-origin' }).then((res) => res.json()) : {};
  const { plugins: urls = [], lists: listsUrl = null, config = {} } = mergeConfig(shared, inline);

  const [modules, lists] = await Promise.all([
    Promise.all(urls.map((url) => import(url).then((m) => m.default))),
    listsUrl ? fetch(listsUrl, { credentials: 'same-origin' }).then((res) => (res.ok ? res.json() : {})) : {},
  ]);
  const handle = await startAntiSmith({ plugins: modules, lists, config });
  document.dispatchEvent(new CustomEvent('anti-smith:ready', { detail: handle }));
}

/** Inline settings win; plugin lists are combined; per-plugin config is merged one level deep. */
export function mergeConfig(shared, inline) {
  const plugins = [...new Set([...(shared.plugins ?? []), ...(inline.plugins ?? [])])];
  const sharedPlugins = shared.config?.plugins ?? {};
  const inlinePlugins = inline.config?.plugins ?? {};
  const pluginConfig = { ...sharedPlugins };
  for (const [id, value] of Object.entries(inlinePlugins)) pluginConfig[id] = { ...sharedPlugins[id], ...value };
  return {
    ...shared,
    ...inline,
    plugins,
    config: { ...shared.config, ...inline.config, plugins: pluginConfig },
  };
}

boot().catch((error) => console.error('[anti-smith]', error));
