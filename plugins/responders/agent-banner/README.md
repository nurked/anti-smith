# Agent banner (protection level 1) — `responder.agent-banner`

Shows a visible notice that this session looks automated and the page is meant for people. Leaves the content alone.

## How it works

Protection level 1 — say it out loud.

Shows a banner at the top of the page once the session looks automated:
"this page is for people; this session looks like an agent". Changes no
content. Readable by people, screen readers and agents alike, so an agent
that reports back what it saw will usually pass the message on.

Engages when the page's protection level (data-as-protection on <html>, or
config.level) is at least `minLevel` and the score reaches `threshold`.

Manual trigger: a `protection-trigger` host event (handle.trigger(), e.g. the CRM's
test controls) engages it at once, regardless of level and threshold. Only
`human-verified` events sent by a protection responder can undo it — never host events.

## Configuration

Override in the host config under `plugins['responder.agent-banner']`. Defaults:

```json
{
  "enabled": false,
  "minLevel": 1,
  "level": null,
  "levelAttribute": "data-as-protection",
  "threshold": 40,
  "thresholdAttribute": "data-as-threshold",
  "message": "This session looks automated. This page is meant to be used by a person, and automated activity here is logged."
}
```
