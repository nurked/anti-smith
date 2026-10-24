/**
 * Weighted score plus an evidence-class breakdown (ADR 0005).
 *
 * The number is the same weighted sum as the built-in scorer, so dashboards and
 * thresholds keep their meaning. On top it tells responders *what kind* of
 * evidence produced it:
 *   - `deterministic`: true when a deterministic detector (webdriver flag,
 *     framework globals, honeypot, synthetic events) has `detected` — the only
 *     basis on which a future deny responder may act.
 *   - `behaviourOnly`: true when every contributor is behavioural — the case
 *     most likely to be a person using assistive technology; add friction at most.
 */
const FACTOR = { detected: 1, suspicious: 0.5 };

export default {
  id: 'scorer.evidence-classes',
  kind: 'scorer',
  version: '0.1.0',
  title: 'Weighted score with evidence classes',
  description: 'Weighted 0–100 score, plus which evidence classes contributed and whether any deterministic signal fired.',
  tags: ['scoring', 'policy'],
  defaults: {
    points: { strong: 40, medium: 15, weak: 5 },
    thresholds: { suspicious: 15, likely: 40 },
  },

  score(findings, ctx) {
    const { points, thresholds } = ctx.config;
    const contributors = findings
      .filter((f) => FACTOR[f.status])
      .map((f) => ({
        id: f.id,
        title: f.title,
        status: f.status,
        weight: f.weight,
        noisy: Boolean(f.noisy),
        evidenceClass: f.evidenceClass ?? null,
        points: (points[f.weight] ?? 0) * FACTOR[f.status],
      }))
      .sort((a, b) => b.points - a.points);

    const score = Math.min(100, Math.round(contributors.reduce((sum, c) => sum + c.points, 0)));
    const level = score >= thresholds.likely ? 'likely-agent' : score >= thresholds.suspicious ? 'suspicious' : 'clean';
    const classes = { deterministic: [], environment: [], behaviour: [] };
    for (const c of contributors) if (classes[c.evidenceClass]) classes[c.evidenceClass].push(c.id);

    return {
      score,
      level,
      contributors,
      classes,
      deterministic: contributors.some((c) => c.evidenceClass === 'deterministic' && c.status === 'detected'),
      behaviourOnly: contributors.length > 0 && contributors.every((c) => c.evidenceClass === 'behaviour'),
    };
  },
};
