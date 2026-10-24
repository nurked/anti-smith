# How to use anti-smith

Add anti-smith to a website so pages with personal data push back when an AI agent or automation tool uses them: a banner (level 1), hidden content (level 2), or a page that shows only a notice to the agent (level 3). People can always continue by verifying with a passkey.

**You need:** Node 20+ on the server · pages served over HTTPS (or `localhost` while developing) · a Chromium, Firefox or Safari release from the last few years.

There is no npm package yet: you copy the files you need into your project.

---

## 1. Try it locally

```bash
git clone https://github.com/nurked/anti-smith.git
cd anti-smith
npm start
```

- Lab (every detector, live): http://localhost:8787/apps/lab/
- Fake CRM (protection levels, test controls): http://localhost:8787/crm

---

## 2. Add it to your site

### Step 1 — Export the browser files

From the anti-smith folder:

```bash
node tools/export.mjs ../my-site/public/anti-smith --base /anti-smith
```

This writes `packages/`, `plugins/`, `lists.json` and a starter `anti-smith.json` config. Serve the folder as static files at `/anti-smith/` (`.js` as `text/javascript`).

`--base` must match the URL path you serve it at. Re-running the export updates the code and lists and keeps your `anti-smith.json`.

### Step 2 — Load it on your pages

Pick one.

**A. Script tag** — any site. Put this in `<head>`:

```html
<script type="application/json" id="anti-smith-config" data-src="/anti-smith/anti-smith.json">{}</script>
<script type="module" src="/anti-smith/packages/embed/src/auto.js"></script>
```

Inline JSON in the first tag is merged over the shared file, so one page can override settings:

```html
<script type="application/json" id="anti-smith-config" data-src="/anti-smith/anti-smith.json">
  { "config": { "plugins": { "responder.lockout": { "threshold": 30 } } } }
</script>
```

To use the handle on the page (single-page apps, passkey setup), listen for it:

```js
document.addEventListener('anti-smith:ready', (event) => {
  const antiSmith = event.detail; // { sessionId, score, onScore, claim, adoptPending, trigger, stepUp }
}, { once: true });
```

**B. JavaScript app** — start it yourself:

```js
import { startAntiSmith } from '/anti-smith/packages/embed/src/index.js';

const site = await fetch('/anti-smith/anti-smith.json').then((res) => res.json());
const plugins = await Promise.all(site.plugins.map((url) => import(url).then((m) => m.default)));
const lists = await fetch(site.lists).then((res) => res.json());
const antiSmith = await startAntiSmith({ plugins, lists, config: site.config });
```

With a bundler, import the plugin files from the exported folder directly instead of fetching the config.

**C. Server or edge** — no page changes. Add the snippet to HTML responses (server code from step 4):

```js
import { injectIntoHtml, bootstrapSnippet } from './anti-smith/index.js';

const snippet = bootstrapSnippet({ autoUrl: '/anti-smith/packages/embed/src/auto.js', configUrl: '/anti-smith/anti-smith.json' });
html = injectIntoHtml(html, snippet); // before </head>; does nothing if the page already has it
```

### Step 3 — Mark your pages

```html
<html lang="en" data-as-protection="2">   <!-- 0 off · 1 banner · 2 + hide content · 3 + agent notice -->
  …
  <main data-as-protected>                <!-- what level 2 hides -->
    <table data-as-sensitive>…</table>    <!-- personal data: watched for script reads -->
  </main>
```

- No `data-as-protection` means level 0: detection and logging only.
- Pages that render DOM after load (React, Vue, htmx, your own code) must tell anti-smith which nodes are theirs, or they flag themselves:

```js
import { createReactHook, vuePlugin, adoptOnEvents, rendering } from '/anti-smith/packages/embed/src/integrations.js';

const useAntiSmith = createReactHook(React, antiSmith); // React: call useAntiSmith() in your root component
app.use(vuePlugin(antiSmith));                         // Vue 3
adoptOnEvents(antiSmith);                              // htmx, Turbo, Unpoly swaps
rendering(antiSmith, () => list.append(row));          // anything else
```

### Step 4 — Add the server side

Copy the server package (Node built-ins only, no dependencies):

```bash
cp -r anti-smith/packages/server/src my-site/server/anti-smith
```

**Node `http`:**

```js
import http from 'node:http';
import { appendFile, readFile } from 'node:fs/promises';
import { createAntiSmithHandler, createStepUp } from './anti-smith/index.js';

const stepUp = createStepUp({ rpId: 'crm.example.com', origins: ['https://crm.example.com'] });
const getUserId = (req) => req.user?.id ?? null; // from your own auth

const antiSmith = createAntiSmithHandler({
  lists: JSON.parse(await readFile('public/anti-smith/lists.json', 'utf8')),
  onRecord: (record) => appendFile('anti-smith.log', JSON.stringify(record) + '\n'), // or your database
  stepUp,
  getUserId,
});

http.createServer(async (req, res) => {
  if (await antiSmith.handle(req, res)) return; // /log, /api/flag, /api/step-up/*, /__as_trap/*
  await antiSmith.inspect(req);                 // optional, any request: signed agents, agent user agents, canaries
  // … your app
}).listen(3000);
```

**Express:** mount it **before** body parsers (it reads the request body itself):

```js
app.use(async (req, res, next) => {
  try {
    if (await antiSmith.handle(req, res)) return;
    next();
  } catch (error) {
    next(error);
  }
});
app.use(express.json());
```

### Step 5 — Let people register a passkey

Levels 2 and 3 ask people to verify with a passkey. They need one registered **before** they meet a protected page. Do it on a page behind your login, never inside a session that already looks automated.

Server — a second handler that only your logged-in account pages can reach, sharing the same `stepUp`:

```js
const passkeys = createAntiSmithHandler({
  stepUp,
  getUserId,
  allowRegistration: true,
  paths: { stepUpPrefix: '/account/step-up/' },
});
// mount `passkeys` only behind authentication
```

Account settings page:

```html
<script type="application/json" id="anti-smith-config" data-src="/anti-smith/anti-smith.json">
  { "config": { "plugins": { "responder.step-up": { "allowRegistration": true, "basePath": "/account/step-up/" } } } }
</script>
<script type="module" src="/anti-smith/packages/embed/src/auto.js"></script>

<button id="passkey" type="button">Set up a passkey</button>
<script type="module">
  document.addEventListener('anti-smith:ready', ({ detail: antiSmith }) => {
    document.getElementById('passkey').addEventListener('click', async () => {
      const { verified, reason } = await antiSmith.stepUp('register');
      alert(verified ? 'Passkey ready.' : `Not set up: ${reason}`);
    });
  }, { once: true });
</script>
```

`createStepUp` keeps credentials in memory. For production, pass your own `store` with the same three methods (`list`, `add`, `update`) backed by your database — see `packages/server/src/webauthn.js`.

### Step 6 — Check it works

1. Open a protected page in your browser. The console shows no `[anti-smith]` errors and `/log` receives POSTs.
2. Open it with an automation tool. Headless browsers are flagged on load, so protection engages at once:

```js
// check.mjs — npm i -D playwright && npx playwright install chromium
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('https://localhost:3000/customers'); // a page with data-as-protection
await page.waitForTimeout(3000);
console.log(await page.evaluate(() => ({
  banner: Boolean(document.querySelector('[data-as-banner]')),
  contentHidden: Boolean(document.querySelector('[data-as-lockout]')),
  noticeOnly: Boolean(document.querySelector('[data-as-notice]')),
})));
await browser.close();
```

3. Read `anti-smith.log` (or wherever `onRecord` writes): one line per event, with the session id, findings and score.

---

## 3. Configure

All settings live in `anti-smith.json` under `config.plugins["<plugin id>"]`, or inline on a page (step 2A).

| To… | Set |
| --- | --- |
| Engage earlier or later | `threshold` on `responder.agent-banner`, `responder.lockout`, `responder.agent-notice` (default 40 of 100) |
| Change the level for one page | `<html data-as-protection="0–3">` |
| Change what level 2 hides | `"selector"` on `responder.lockout` (default `[data-as-protected]`) |
| Change the notice wording | `"heading"`, `"paragraphs"`, `"documentTitle"` on `responder.agent-notice` — have it reviewed |
| Change the banner text | `"message"` on `responder.agent-banner` |
| Hide individual fields instead of whole regions | add `/anti-smith/plugins/responders/redact/index.js` to `plugins`, set `"responder.redact": { "enabled": true }` |
| Turn a plugin off | `{ "enabled": false }`, or remove its URL from `plugins` |
| Add or remove detectors | edit the `plugins` list; all available ones are in `/anti-smith/plugins/` |
| Update agent extension IDs, framework markers | re-run the export after pulling anti-smith (updates `lists.json`) |

What each plugin does: [plugin-catalog.md](plugin-catalog.md).

---

## 4. Before going live

- [ ] HTTPS everywhere; `rpId` and `origins` in `createStepUp` match your domain.
- [ ] `allowRegistration` is `true` **only** on the logged-in passkey handler and page.
- [ ] Passkeys stored in your database, not in memory.
- [ ] Thresholds chosen after testing with real people, including screen-reader, voice-control and switch-access users — behavioural signals overlap with assistive technology.
- [ ] Notice and banner wording approved (legal, accessibility).
- [ ] Privacy review: anti-smith logs behaviour (timings, counts — never typed text or field values); decide retention for `onRecord` output.
- [ ] Server-side controls for the most sensitive data (rate limits, audit logs). Client-side detection can be bypassed by whoever controls the browser.

---

## Reference

- [Plugin catalog](plugin-catalog.md) · [Plugin API](plugin-api.md) · [Architecture](architecture.md)
- [Research](research.md) — what each detector catches and misses, measured
- [ADR 0005](adr/0005-responders-opt-in.md), [ADR 0006](adr/0006-protection-levels.md) — why levels add friction and always keep a human path
