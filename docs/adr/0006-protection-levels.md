# ADR 0006 — Protection levels 1–3

Date: 2026-10-24 · Status: accepted · Builds on [ADR 0005](0005-responders-opt-in.md)

## Context

Site owners need a simple dial for how hard a page pushes back once a session looks automated, and a test site (Northwind CRM, `apps/crm`) to try it on.

## Decision

Three independent responders, each engaging when the page's protection level (`<html data-as-protection="0–3">`, or `config.level`) reaches its minimum **and** the score reaches its threshold (default 40, overridable per page with `<html data-as-threshold>`):

| Level | Responder | Effect |
| --- | --- | --- |
| 1 | `responder.agent-banner` | A visible banner: this session looks automated; the page is for people. Content untouched. |
| 2 | + `responder.lockout` | Protected regions (`[data-as-protected]`) are detached from the DOM and kept in memory; a placeholder remains. |
| 3 | + `responder.agent-notice` | Everything in `<body>` is detached; the only readable element is a notice to AI agents (and to any person seeing it by mistake). Later additions to `<body>` are held back too. The page title changes. |

- Levels 2 and 3 always keep a human path: "I am a person — verify" runs WebAuthn step-up (`responder.step-up`); success sends `human-verified`, which every protection responder honours. A behavioural score therefore still only adds friction (ADR 0005).
- **Manual trigger.** A `protection-trigger` host event (`handle.trigger(id?)`, the CRM's test controls) engages a layer at once, regardless of level and threshold. Triggers only add protection. `human-verified` is honoured only when a responder sends it (after step-up), never from the host, so page scripts — or an agent holding the handle — cannot unlock content through events.
- The notice states policy; it is not the protection. Reputable agents treat page text as untrusted content, so compliance cannot be assumed. The protection is that the content is no longer in the page.
- **Wording is the site owner's**, set through `heading` / `paragraphs`. The default says automated access "is not authorised … breaks this site's terms of use and may be unlawful" — deliberately not a flat claim of illegality, which depends on jurisdiction and terms and should come from legal review.

## Consequences

- Anything read before the threshold is crossed has already been read. In the in-app agent test the score reached 25–33 over a short task, below the default 40; at threshold 25 the notice replaced the page mid-task (research.md, sixth observation). Thresholds remain the open question until human baselines exist.
- The notice is equally visible to people who are wrongly flagged; it must stay polite, accurate and offer verification.
- Level and threshold are page attributes that main-world scripts could change; tamper resistance is part of the hardening roadmap item.
