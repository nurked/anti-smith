/**
 * Typing rhythm and text that appears without key presses.
 *
 * People type with irregular gaps. Automation types with near-constant gaps
 * (`page.type(…, { delay })`) or inserts text with no keydown at all
 * (Playwright `fill()`, CDP Input.insertText).
 *
 * Privacy: only timestamps and lengths are kept — never keys or text.
 */
const IGNORED_INPUT_TYPES = new Set(['insertFromPaste', 'insertFromDrop', 'insertReplacementText', 'insertFromYank']);

export default {
  id: 'detector.keyboard-dynamics',
  kind: 'detector',
  version: '0.1.0',
  title: 'Keyboard dynamics',
  description: 'Inter-key interval variance, and text inserted through input events without a preceding keydown.',
  weight: 'medium',
  phase: 'runtime',
  tags: ['behaviour', 'keyboard'],
  limitations: [
    'Dictation, IME composition and some accessibility keyboards insert text without keydown events.',
    'Password managers and browser autofill are excluded by inputType, but not all of them set it.',
    'Agents adding random delays between keystrokes will pass the rhythm check.',
  ],
  defaults: {
    burstGapMs: 1500,
    minKeys: 8,
    regularCv: 0.1,
    keylessWindowMs: 60,
    bulkChars: 4,
    minKeyless: 2,
  },

  start(ctx) {
    const { document: doc, config } = ctx;
    if (!doc) return ctx.report({ status: 'unsupported', evidence: { reason: 'no document' } });
    const s = ctx.state;
    s.intervals = [];
    s.lastKeyAt = null;
    s.keyless = 0;
    s.bulk = 0;

    const evaluate = () => {
      const recent = s.intervals.slice(-40);
      const stats = recent.length >= config.minKeys ? describe(recent) : null;
      const regular = Boolean(stats && stats.cv < config.regularCv);
      const keyless = s.keyless >= config.minKeyless;
      const evidence = { keys: s.intervals.length + (s.lastKeyAt === null ? 0 : 1), rhythm: stats, keylessInserts: s.keyless, bulkInserts: s.bulk };
      if (regular && keyless) ctx.escalate({ status: 'detected', evidence });
      else if (regular || keyless || s.bulk) ctx.escalate({ status: 'suspicious', evidence });
      else ctx.escalate({ status: 'clean', evidence });
    };

    ctx.on(doc, 'keydown', (e) => {
      if (e.repeat || e.isComposing || ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return;
      if (s.lastKeyAt !== null) {
        const gap = e.timeStamp - s.lastKeyAt;
        if (gap < config.burstGapMs) s.intervals.push(gap);
      }
      s.lastKeyAt = e.timeStamp;
      if (s.intervals.length && s.intervals.length % 5 === 0) evaluate();
    });

    ctx.on(doc, 'input', (e) => {
      const type = e.inputType ?? '';
      if (e.isComposing || !type.startsWith('insert') || IGNORED_INPUT_TYPES.has(type)) return;
      if (s.lastKeyAt !== null && e.timeStamp - s.lastKeyAt <= config.keylessWindowMs) return;
      const length = typeof e.data === 'string' ? e.data.length : null;
      s.keyless++;
      if (length !== null && length >= config.bulkChars) s.bulk++;
      ctx.log('keyless-input', { inputType: type, length, target: ctx.describe(e.target) });
      evaluate();
    });

    ctx.report({ status: 'clean', evidence: { keys: 0 } });
  },
};

function describe(values) {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  return { n: values.length, meanMs: Math.round(mean), sdMs: Math.round(sd), cv: mean ? Math.round((sd / mean) * 1000) / 1000 : 0 };
}
