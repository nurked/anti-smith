# Weighted score with evidence classes — `scorer.evidence-classes`

Weighted 0–100 score, plus which evidence classes contributed and whether any deterministic signal fired.

## How it works

Weighted score plus an evidence-class breakdown (ADR 0005).

The number is the same weighted sum as the built-in scorer, so dashboards and
thresholds keep their meaning. On top it tells responders *what kind* of
evidence produced it:
  - `deterministic`: true when a deterministic detector (webdriver flag,
    framework globals, honeypot, synthetic events) has `detected` — the only
    basis on which a future deny responder may act.
  - `behaviourOnly`: true when every contributor is behavioural — the case
    most likely to be a person using assistive technology; add friction at most.

## Configuration

Override in the host config under `plugins['scorer.evidence-classes']`. Defaults:

```json
{
  "points": {
    "strong": 40,
    "medium": 15,
    "weak": 5
  },
  "thresholds": {
    "suspicious": 15,
    "likely": 40
  }
}
```
