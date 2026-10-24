/**
 * Default scorer: turns detector findings into a 0–100 score.
 *
 * Each finding contributes `points[weight] * factor[status]`. The sum is capped
 * at 100. The scorer is swappable: pass `scorer` to `createRuntime()`.
 */

export const DEFAULT_POINTS = Object.freeze({ strong: 40, medium: 15, weak: 5 });
export const STATUS_FACTOR = Object.freeze({ detected: 1, suspicious: 0.5 });
export const DEFAULT_THRESHOLDS = Object.freeze({ suspicious: 15, likely: 40 });

export function scoreFindings(findings, options = {}) {
  const points = { ...DEFAULT_POINTS, ...options.points };
  const thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };

  const contributors = findings
    .filter((finding) => STATUS_FACTOR[finding.status])
    .map((finding) => ({
      id: finding.id,
      title: finding.title,
      status: finding.status,
      weight: finding.weight,
      noisy: Boolean(finding.noisy),
      points: (points[finding.weight] ?? 0) * STATUS_FACTOR[finding.status],
    }))
    .sort((a, b) => b.points - a.points);

  const total = contributors.reduce((sum, c) => sum + c.points, 0);
  const score = Math.min(100, Math.round(total));
  const level = score >= thresholds.likely ? 'likely-agent' : score >= thresholds.suspicious ? 'suspicious' : 'clean';

  return { score, level, contributors };
}
