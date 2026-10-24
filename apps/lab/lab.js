/**
 * Agent Detection Lab — UI glue.
 *
 * Discovers plugins from the server, starts a runtime, and renders findings,
 * the score and the event log. All detection logic lives in plugins/; this
 * file only displays what the runtime reports.
 *
 * Rules for this file (so the lab does not trip its own detectors):
 *  - all re-rendered UI lives under [data-as-ignore];
 *  - never read the sensitive table's text;
 *  - never dispatch synthetic events into the document.
 */
import { createRuntime, validatePlugin } from '/packages/core/src/index.js';
import config from './lab.config.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const listParam = (name) => (params.get(name) ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const only = listParam('only');
const skip = new Set(listParam('skip'));

const STATUS_ORDER = { detected: 0, suspicious: 1, error: 2, clean: 3, pending: 4, unsupported: 5 };
const WEIGHT_ORDER = { strong: 0, medium: 1, weak: 2 };
const MAX_LOG_ROWS = 400;

const openEvidence = new Set();
let runtime;
let renderQueued = false;

main().catch((error) => showErrors([{ id: 'lab', message: error?.stack ?? String(error) }]));

async function main() {
  const [entries, lists] = await Promise.all(
    ['/api/plugins', '/api/lists'].map((url) => fetch(url, { cache: 'no-store' }).then((res) => res.json())),
  );
  // ?only= narrows detectors; sinks and responders always load unless skipped.
  const chosen = entries.filter((e) => !skip.has(e.id) && (!only.length || e.kind !== 'detector' || only.includes(e.id)));

  const plugins = [];
  const errors = [];
  const settled = await Promise.allSettled(chosen.map((entry) => import(entry.path)));
  settled.forEach((result, i) => {
    const { id } = chosen[i];
    if (result.status === 'rejected') return errors.push({ id, message: String(result.reason?.message ?? result.reason) });
    const problems = validatePlugin(result.value.default);
    if (problems.length) return errors.push({ id, message: problems.join('; ') });
    plugins.push(result.value.default);
  });
  showErrors(errors);

  runtime = createRuntime({ plugins, config, lists });
  // Lab only: exposed for debugging from the console. Never expose the runtime on a production page.
  window.antiSmith = runtime;

  runtime.onChange(queueRender);
  runtime.log.subscribe(queueRender);
  wireControls();
  wireTestArea();
  renderLimitations();

  await runtime.start();
  const skipped = entries.length - chosen.length;
  $('plugin-summary').textContent = `${plugins.length} plugins loaded${skipped ? `, ${skipped} skipped` : ''} · session ${runtime.sessionId}`;
  render();
}

// ------------------------------------------------------------------ render

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  setTimeout(() => {
    renderQueued = false;
    render();
  }, 150);
}

function render() {
  if (!runtime) return;
  renderScore(runtime.score());
  renderFindings(runtime.findings());
  renderLog(runtime.log.all());
}

function renderScore({ score, level, contributors }) {
  $('score').textContent = String(score);
  const levelEl = $('level');
  levelEl.textContent = level.replace('-', ' ');
  levelEl.className = `score-level level-${level}`;
  $('contributors').textContent = contributors.length
    ? contributors.map((c) => `${c.id.replace('detector.', '')} +${c.points}${c.noisy ? ' (noisy)' : ''}`).join(' · ')
    : 'no contributing detectors';
}

function renderFindings(findings) {
  const sorted = [...findings].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || WEIGHT_ORDER[a.weight] - WEIGHT_ORDER[b.weight] || a.id.localeCompare(b.id),
  );
  const rows = sorted.map((f) => {
    const name = el('td', {}, [el('span', {}, f.title), f.noisy ? el('span', { class: 'badge' }, 'noisy') : null, el('span', { class: 'id' }, f.id)]);
    const details = el('details', {}, [el('summary', {}, summarise(f.evidence)), el('pre', {}, JSON.stringify(f.evidence, null, 2))]);
    details.open = openEvidence.has(f.id);
    details.addEventListener('toggle', () => (details.open ? openEvidence.add(f.id) : openEvidence.delete(f.id)));
    return el('tr', {}, [
      name,
      el('td', {}, f.weight),
      el('td', {}, el('span', { class: `pill ${f.status}` }, f.status)),
      el('td', {}, details),
      el('td', { class: 'muted' }, `${(f.updatedAt / 1000).toFixed(1)}s`),
    ]);
  });
  $('findings').replaceChildren(...rows);
}

function renderLog(events) {
  const filter = $('log-filter').value.trim().toLowerCase();
  const hideRaw = $('hide-noise').checked;
  const visible = [];
  for (let i = events.length - 1; i >= 0 && visible.length < MAX_LOG_ROWS; i--) {
    const e = events[i];
    if (hideRaw && e.type === 'event') continue; // the per-event isTrusted firehose from detector.input-trust
    const text = JSON.stringify(e.data ?? '');
    if (filter && !`${e.source} ${e.type} ${text}`.toLowerCase().includes(filter)) continue;
    visible.push(
      el('li', {}, [
        el('span', { class: 't' }, `${(e.t / 1000).toFixed(1)}s`),
        el('span', { class: 'src', title: e.source }, e.source.replace(/^(detector|responder|sink)\./, '')),
        el('span', { class: 'data' }, [el('b', {}, e.type), ' ', text.length > 400 ? `${text.slice(0, 400)}…` : text]),
      ]),
    );
  }
  $('events').replaceChildren(...visible);
  $('event-count').textContent = `${events.length} events`;
}

function renderLimitations() {
  const cards = runtime
    .plugins()
    .filter((p) => p.limitations?.length)
    .map((p) => el('div', {}, [el('strong', {}, p.title), el('ul', {}, p.limitations.map((text) => el('li', {}, text)))]));
  $('limitations').replaceChildren(...cards);
}

function showErrors(errors) {
  $('load-errors').replaceChildren(...errors.map((e) => el('div', { class: 'error-box' }, `${e.id}: ${e.message}`)));
}

function summarise(evidence) {
  if (evidence == null) return '—';
  const text = JSON.stringify(evidence);
  return text.length > 90 ? `${text.slice(0, 90)}…` : text;
}

/** Tiny element builder. Children may be strings, nodes, arrays or null. */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  for (const child of [children].flat(2)) {
    if (child == null) continue;
    node.append(child);
  }
  return node;
}

// ---------------------------------------------------------------- controls

function wireControls() {
  $('log-filter').addEventListener('input', queueRender);
  $('hide-noise').addEventListener('change', queueRender);
  $('clear').addEventListener('click', () => {
    runtime.log.clear();
    render();
  });
  $('export').addEventListener('click', () => {
    const label = ($('run-label').value.trim() || 'unlabelled').replace(/[^a-z0-9._-]+/gi, '-');
    const data = runtime.exportJSON({ label, url: location.href, userAgent: navigator.userAgent, exportedFrom: 'lab' });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `anti-smith-${label}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    // Detached element: its synthetic click never reaches document listeners, so input-trust stays clean.
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });
}

function wireTestArea() {
  $('login-form').addEventListener('submit', (event) => {
    event.preventDefault();
    $('login-status').textContent = `Submitted at ${new Date().toLocaleTimeString()} (nothing is sent anywhere).`;
  });
  $('testarea').addEventListener('click', (event) => {
    const button = event.target.closest?.('button[data-action]');
    if (button) $('action-status').textContent = `"${button.textContent}" clicked at ${new Date().toLocaleTimeString()}.`;
  });
}
