/**
 * For pages built as JavaScript apps (contact detail, deals): load the shared
 * site config, import its plugins and start anti-smith with startAntiSmith().
 * A bundled app would import these modules at build time instead.
 */
import { startAntiSmith } from '/packages/embed/src/index.js';

export async function bootAntiSmith(configUrl = '/apps/crm/anti-smith.json') {
  const site = await fetch(configUrl).then((res) => res.json());
  const [plugins, lists] = await Promise.all([
    Promise.all(site.plugins.map((url) => import(url).then((m) => m.default))),
    site.lists ? fetch(site.lists).then((res) => res.json()) : {},
  ]);
  return startAntiSmith({ plugins, lists, config: site.config });
}

/**
 * Footer readout for testers: protection level, how the page loaded anti-smith,
 * and the live score. The footer element is the page's own; its text is
 * claimed after each update so the DOM detector does not flag it.
 */
export function showDebug(handle) {
  const footer = document.getElementById('crm-debug');
  if (!footer) return;
  const root = document.documentElement;
  const render = (result) => {
    const basis = result.deterministic ? ', deterministic evidence' : result.behaviourOnly ? ', behaviour only' : '';
    const why = result.contributors.map((c) => `${c.id.replace(/^detector\./, '')}:${c.status}`).join(', ');
    const at = root.dataset.asThreshold ? ` at score ≥ ${root.dataset.asThreshold}` : ' at score ≥ 40';
    footer.textContent = `Protection level ${root.dataset.asProtection}${at} (${root.dataset.levelSource}) · loaded via ${root.dataset.loadedVia} · score ${result.score} ${result.level}${basis}${why ? ` · ${why}` : ''}`;
    handle.claim(footer);
  };
  handle.onScore(render);
  render(handle.score());
}
