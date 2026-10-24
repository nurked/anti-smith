/**
 * The plugin contract shared by every anti-smith plugin.
 *
 * A plugin is a plain object exported as the default export of its module.
 * Plugins never import anything: everything they need arrives through the
 * context object (`ctx`) the runtime hands to `start()`. That keeps plugins
 * independent of each other, loadable in any order, and easy to bundle.
 * See docs/plugin-api.md for the full reference.
 */

/** The plugin kinds. A plugin id is always prefixed with its kind. */
export const KINDS = Object.freeze(['detector', 'responder', 'sink', 'scorer']);

/** Detector statuses. */
export const STATUS = Object.freeze({
  PENDING: 'pending',
  UNSUPPORTED: 'unsupported',
  ERROR: 'error',
  CLEAN: 'clean',
  SUSPICIOUS: 'suspicious',
  DETECTED: 'detected',
});

/** Ordering used by `ctx.escalate()`: a finding only ever moves up this ladder. */
export const STATUS_RANK = Object.freeze({
  pending: 0,
  unsupported: 0,
  error: 0,
  clean: 1,
  suspicious: 2,
  detected: 3,
});

/** How much a detector's verdict counts towards the score. */
export const WEIGHTS = Object.freeze(['strong', 'medium', 'weak']);

/**
 * What kind of evidence a detector produces (ADR 0005):
 *  - deterministic: people essentially never produce it (webdriver flag, honeypot touched, synthetic events)
 *  - environment:   how the browser is set up (headless signs, patched natives, extensions installed)
 *  - behaviour:     how input arrives (mouse, keyboard, timing) — overlaps with assistive technology
 */
export const EVIDENCE = Object.freeze(['deterministic', 'environment', 'behaviour']);

const ID_PATTERN = /^(detector|responder|sink|scorer)\.[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
/** "<list-name>" or "<list-name>.<key>[.<key>…]" — see lists/README.md. */
export const LIST_PATH_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[A-Za-z0-9_]+)*$/;

/**
 * Returns a list of human-readable problems with a plugin object.
 * An empty list means the plugin satisfies the contract.
 */
export function validatePlugin(plugin) {
  if (!plugin || typeof plugin !== 'object') {
    return ['plugin must be an object (the module default export)'];
  }
  const problems = [];
  const { id, kind } = plugin;

  if (typeof id !== 'string' || !ID_PATTERN.test(id)) {
    problems.push(`id "${id}" must look like "<kind>.<kebab-name>"`);
  }
  if (!KINDS.includes(kind)) {
    problems.push(`kind must be one of ${KINDS.join(', ')}`);
  } else if (typeof id === 'string' && !id.startsWith(`${kind}.`)) {
    problems.push(`id "${id}" must start with "${kind}."`);
  }
  if (typeof plugin.version !== 'string' || !SEMVER_PATTERN.test(plugin.version)) {
    problems.push('version must be semver, e.g. "0.1.0"');
  }
  for (const field of ['title', 'description']) {
    if (typeof plugin[field] !== 'string' || !plugin[field].trim()) problems.push(`${field} is required`);
  }
  if (plugin.start !== undefined && typeof plugin.start !== 'function') {
    problems.push('start must be a function');
  }
  if (plugin.defaults !== undefined && (typeof plugin.defaults !== 'object' || plugin.defaults === null)) {
    problems.push('defaults must be an object');
  }
  if (plugin.tags !== undefined && !isStringArray(plugin.tags)) {
    problems.push('tags must be an array of strings');
  }
  if (plugin.lists !== undefined) {
    const entries = plugin.lists && typeof plugin.lists === 'object' ? Object.entries(plugin.lists) : null;
    if (!entries || entries.some(([, path]) => typeof path !== 'string' || !LIST_PATH_PATTERN.test(path))) {
      problems.push('lists must map config keys to list paths like "automation-globals.names"');
    }
  }

  if (kind === 'detector') {
    if (!WEIGHTS.includes(plugin.weight)) problems.push(`weight must be one of ${WEIGHTS.join(', ')}`);
    if (typeof plugin.start !== 'function') problems.push('detectors must implement start(ctx)');
    if (!isStringArray(plugin.limitations) || plugin.limitations.length === 0) {
      problems.push('detectors must list at least one limitation');
    }
    if (!EVIDENCE.includes(plugin.evidence)) problems.push(`evidence must be one of ${EVIDENCE.join(', ')}`);
  }
  if (kind === 'responder' && typeof plugin.onScore !== 'function') {
    problems.push('responders must implement onScore(result, ctx)');
  }
  if (kind === 'sink' && typeof plugin.onEvent !== 'function') {
    problems.push('sinks must implement onEvent(event, ctx)');
  }
  if (kind === 'scorer' && typeof plugin.score !== 'function') {
    problems.push('scorers must implement score(findings, ctx)');
  }
  return problems;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
