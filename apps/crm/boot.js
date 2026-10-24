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
  showTestControls(handle);
}

/**
 * Trigger box for testers: engage a protection layer now, whatever the score and
 * page level, or reset by reloading (protection state lives only in memory).
 * Triggers only ever add protection; nothing here can unlock a page.
 */
export function showTestControls(handle) {
  const box = document.createElement('aside');
  box.setAttribute('aria-label', 'Test controls');
  box.className = 'test-controls';
  const title = document.createElement('strong');
  title.textContent = 'Test controls';
  box.append(title);
  const actions = [
    ['Banner', 'responder.agent-banner'],
    ['Lockout', 'responder.lockout'],
    ['Agent notice', 'responder.agent-notice'],
    ['All three', null],
  ];
  for (const [label, responder] of actions) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', () => handle.trigger(responder));
    box.append(button);
  }
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'secondary';
  reset.textContent = 'Reset';
  reset.title = 'Reload the page: protection starts over from the score';
  reset.addEventListener('click', () => location.reload());
  box.append(reset);
  handle.claim(box); // the page's own UI, so the DOM detector does not flag it
  document.body.append(box);
}
