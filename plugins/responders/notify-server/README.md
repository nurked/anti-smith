# Notify server — `responder.notify-server`

POSTs { sessionId, level, score, contributors } to the server each time the score reaches a higher level. Never alters the page.

## How it works

Tells the server when this session's score rises to a new level, so the
server can apply its own policy (rate-limit sensitive endpoints, require
step-up, alert someone). Changes nothing on the page.

## Configuration

Override in the host config under `plugins['responder.notify-server']`. Defaults:

```json
{
  "endpoint": "/api/flag",
  "minLevel": "suspicious"
}
```
