# HTTP log sink — `sink.http-log`

Batches events to POST /log, using sendBeacon on page hide.

## How it works

Ships events to the lab server in batches: POST { sessionId, events } to
`endpoint`. On page hide it flushes with navigator.sendBeacon. If the server
is not there, it gives up quietly after a few failures (the in-memory log
and JSON export still work).

## Configuration

Override in the host config under `plugins['sink.http-log']`. Defaults:

```json
{
  "endpoint": "/log",
  "batchSize": 50,
  "flushMs": 2000,
  "maxFailures": 3
}
```
