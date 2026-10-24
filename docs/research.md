# Research: keeping AI agents away from sensitive pages

Status: living document, started 2026-10-24. Owner: project maintainers.
Everything marked **hypothesis** must be confirmed by a run in [test-plan.md](test-plan.md) before any detector's weight or any blocking decision relies on it.

## 1. The question

We want a site-side component — "uBlock Origin, but installed by the website" — that keeps browser automation and AI agents from reading or acting on pages that show very sensitive personal data.

Three things make this harder than ad blocking:

1. **The adversary runs the browser.** Anything a page checks in JavaScript can be faked by whoever controls the browser. Client-side detection gives *evidence*, never proof.
2. **Many agents are the user.** Extension agents (Claude for Chrome and similar) and agentic browsers run inside the person's own signed-in browser, with their cookies and their authority. To the site they look like that person.
3. **Assistive technology looks like a bot.** Voice control, switch access and screen readers click without moving the mouse, at element centres, and insert text without key presses. Blocking on behaviour alone would lock out disabled users, which is both harmful and, in many places, unlawful.

So the project is not "detect and block". It is three layers, built in this order:

| Layer | Question | Where it runs | This repo |
| --- | --- | --- | --- |
| Observe | What traces do agents leave? | Page (plugins) + server log | **v0: the lab** |
| Decide | How confident are we, and what is the cost of being wrong? | Scoring + server-side signals | partly (scoring) |
| Respond | Redact, ask for human presence, rate-limit, notify, block | Responder plugins + server | stub only |

## 2. Who the "agents" are

| Class | Examples | How it drives the page | What a page can see |
| --- | --- | --- | --- |
| A. HTTP fetchers | crawlers, "browse" tools that fetch HTML | No JavaScript at all | Nothing client-side. Server: user agent, IP/ASN, TLS fingerprint, Web Bot Auth signature. |
| B. Headless automation | Playwright, Puppeteer, Selenium, cloud browser services | CDP or WebDriver(/BiDi) | Strong static tells (`navigator.webdriver`, globals, headless signs), CDP side effects, robotic input. |
| C. Stealth automation | puppeteer-extra-stealth, patched Playwright/ChromeDriver forks, anti-detect browsers | Same as B with patches | Patched natives, inconsistencies between APIs, behaviour. |
| D. Extension agents | Claude for Chrome and other agent extensions | Real profile. Input and screenshots most likely through `chrome.debugger` (CDP), reading through content scripts or CDP (**hypothesis**, to verify per product) | No headless tells. Trusted events. Behaviour, DOM overlays they inject, input while the tab is unfocused, extension probing. |
| E. Agentic browsers | Perplexity Comet, ChatGPT Atlas (one source says Atlas was shut down in Aug 2026 — unverified) | Agent built into a Chromium fork | Reported to be indistinguishable from Chrome by user agent and logs; behaviour only. |
| F. Computer-use agents | Model + screenshots + OS-level mouse/keyboard | Real OS input on a real desktop | Only behaviour and timing (cursor jumps, think-time pauses). Screenshots are invisible to the page. |
| G. People with assistive tech | Voice Control, Dragon, switch access, screen readers | OS accessibility APIs | Many of the same behavioural tells as D–F. **Must not be blocked.** |

Industry write-ups agree that D and E are the hard cases: they "show up in logs as normal Chrome sessions" ([CJR](https://cjr.org/analysis/how-ai-browsers-sneak-past-blockers-and-paywalls.php)) and vendors detect them by combining identity, network, environment and behaviour signals rather than any single tell ([cside](https://cside.com/blog/guide-to-detect-ai-agent-traffic-on-your-website), [HUMAN](https://humansecurity.com/learn/blog/chatgpt-atlas-vs-perplexity-comet-agentic-browsers/)).

## 3. What a page can observe — the "worlds" model

Most confusion about client-side detection comes from not separating where code runs:

| Where the agent's code runs | Page JS sees its calls? | Page sees its DOM changes? | Page sees its events? |
| --- | --- | --- | --- |
| Page main world (`page.evaluate`, `world: 'MAIN'` injected scripts) | **Yes** — patched/observed APIs, stack traces | Yes | Yes |
| Isolated world (extension content scripts, Playwright utility world) | **No** — separate JS globals and prototypes | Yes (shared DOM) | Synthetic events: yes, with `isTrusted: false` |
| CDP from outside (`Input.*`, `DOM.*`, `Accessibility.*`, `Page.captureScreenshot`) | No | Only if it mutates DOM | Yes, and they are **trusted** |
| Operating system (computer-use agents) | No | No | Yes, trusted, indistinguishable at the API level |

Consequences for the design:

- Hooking `innerText`, `querySelectorAll` and friends (detector `sensitive-reads`) only catches main-world readers. It is still worth having: `page.evaluate` is the most common scraping path for B and C, and stack traces name the culprit (`__puppeteer_evaluation_script__`, `UtilityScript`, `chrome-extension://<id>`).
- `isTrusted` (detector `input-trust`) catches extension content scripts that call `element.click()` — but not anything that uses CDP input.
- The DOM is shared by everyone, which is why DOM-mutation and honeypot detectors see extension agents that hooks cannot.
- For CDP- and OS-driven input, behaviour (how the pointer arrives, how text arrives, when actions happen) is the main remaining signal.

## 4. Signal catalogue

Weights are starting points, to be revised with measured false-positive rates. Full metadata: [plugin-catalog.md](plugin-catalog.md).

| Signal | Plugin | Catches | Misses / spoofed by | False-positive risk |
| --- | --- | --- | --- | --- |
| `navigator.webdriver` true or deleted | `webdriver` | Default B | C (`AutomationControlled` disabled), D, E, F | Very low |
| Framework globals (`cdc_`, `__playwright__binding__`, …) | `automation-globals` | B, some C | Patched drivers, isolated worlds | Very low |
| HeadlessChrome UA/hints, empty plugins, software WebGL, 0×0 outer window | `headless` | Old headless B | New headless, C, D, E | Medium: VMs, RDP, embedded webviews (our own in-app browser reports a 0×0 outer window) |
| Notification permission mismatch | `permissions-consistency` | Old headless | Modern headless, C | Low |
| Non-native toString, cross-realm mismatch, wrong function shape | `native-patches` | C | Kits that also patch iframes / use Proxies | Medium: zone.js, error trackers, privacy extensions |
| Console serialisation getters fire | `cdp-console` | B/C with Runtime enabled; maybe D | V8 change silenced the `Error.stack` variant ([Castle](https://blog.castle.io/why-a-classic-cdp-bot-detection-signal-suddenly-stopped-working-and-nobody-noticed/)); BiDi; frameworks avoiding `Runtime.enable` | High: DevTools users ([DataDome](https://datadome.co/threat-research/how-new-headless-chrome-the-cdp-signal-are-impacting-bot-detection/)) |
| `debugger` pause timing | `debugger-timing` | Debugger domain enabled | Almost all automation | High: DevTools users |
| Foreign DOM nodes, shadow hosts, marker attributes | `dom-mutations` | D (overlays, highlights), some B tooling | Agents that inject nothing | High: any extension that injects UI |
| `isTrusted: false` user events | `input-trust` | Content-script agents, naive scripts | All CDP/OS input | Very low |
| Teleporting pointer, exact-centre clicks, straight paths | `mouse-dynamics` | B, C, D via CDP; some F | Agents with synthetic human paths | Medium: assistive tech |
| Constant key rhythm; text with no keydown | `keyboard-dynamics` | `fill()`, `insertText`, fixed-delay typing | Randomised typing | Medium: dictation, IME, autofill |
| Programmatic focus, unexplained scroll, input while hidden/unfocused | `focus-scroll` | D driving a background tab; `scrollIntoView` before CDP clicks | Agents that keep the tab focused | Low for hidden input; medium otherwise |
| Fast first action, regular gaps, stop-and-go think pauses | `interaction-timing` | LLM agents (seconds of stillness, then instant action) | Randomised timing | Medium: keyboard users, readers |
| Main-world reads of sensitive content | `sensitive-reads` | `page.evaluate` scraping, main-world extension scripts | Isolated worlds, CDP DOM/AX reads, screenshots | Low on pages that do not read their own content |
| Viewport-only resize, frame stalls near actions | `capture-hints` | CDP emulation, maybe CDP screenshots (**hypothesis**) | OS-level capture | High: DevTools emulation, busy main thread |
| `chrome-extension://` resource loads | `extension-probe` | Known agent extensions *installed* | `use_dynamic_url`, extensions with no web-accessible resources; installed ≠ active | Low, but it is fingerprinting (see §7) |
| Hidden honeypots touched; canary token resurfaces | `honeypots` | DOM-reading agents acting on raw markup | Vision-only and accessibility-tree agents | Very low (traps are hidden from AT and tab order) |

### First observation (n = 1, 2026-10-24)

The lab was driven by the Claude desktop app's built-in browser pane (an automation-controlled embedded Chromium) clicking three buttons, typing into the textarea and extracting page text:

| Fired | Did not fire |
| --- | --- |
| `mouse-dynamics` **detected**: 3/3 clicks teleported to the exact centre of the button | `input-trust`: every event `isTrusted: true` (CDP input) |
| `keyboard-dynamics` suspicious: the typed text arrived as one `insertText` with no keydown | `cdp-console`: getters never fired (consistent with the reported V8 change) |
| `capture-hints` suspicious: 3 animation-frame stalls within 2 s of actions (screenshots?) | `webdriver`, `automation-globals`, `native-patches` |
| `headless` suspicious: outer window 0×0 (embedded webview) | `sensitive-reads`: page-text extraction did not touch main-world getters |

Score 33 (suspicious, below the 40 "likely agent" line). This matches the model in §3: when input and reading go through CDP, the static and hook-based checks are blind and behaviour carries the signal. The user agent also contained a `Claude/<version>` product token — a reminder that some embedded agents do identify themselves and the server should log the UA.

### Second observation (n = 1, 2026-10-24)

Same in-app browser, full task script: type username, set password with the tool's "form fill" action, submit, two buttons, type notes, wheel-scroll, click a link, read the page, look for the traps, open the trap URL.

| Fired | Did not fire |
| --- | --- |
| `input-trust` **detected**: the form-fill action set the password by script, producing untrusted `input` and `change` events | `webdriver`, `automation-globals`, `native-patches`, `headless` (outer size was normal this time) |
| `mouse-dynamics` **detected**: 6/6 clicks on the exact centre, 4 with zero moves | `sensitive-reads`: page text and the table were read without touching main-world getters |
| `keyboard-dynamics` suspicious: typed text arrived as single `insertText` events, no keydown | `capture-hints`: no frame stalls this time (first run had 3) — not reproducible yet |
| Server: opening the trap link logged `trap-hit` + `canary-hit` with `Sec-Fetch-Site: none` (direct navigation, not a click) | In-page honeypots: the tool *saw* the `aria-hidden` traps (its element search reads the DOM) but refused to click elements outside the viewport |

Score 63, "likely agent" (crossed 40 at the first form fill). New observations to turn into detectors or fixes:

- ~~**Window blur → focus around every action.**~~ Retracted: a logging bug. Capturing listeners on `window` also receive element focus/blur, so ordinary focus changes from clicks looked like window flicker. With the filter fixed, agent clicks produce no window blur/focus at all.
- **Embedded panes break the DevTools heuristic.** Outer window 3008 px vs inner 1350 px made `cdp-console` assume DevTools was docked. Width-gap heuristics need an embedded-webview exception.
- **Honeypot placement.** Off-screen traps are seen but not clickable by this agent. Traps inside the viewport but transparent (still `aria-hidden`, out of tab order) would test click-by-reference agents.

### Third observation: Claude in Chrome (2026-10-24)

The extension driving the lab in a normal, signed-in Google Chrome (Chrome 156, macOS). Two sessions.

| Signal | Session A (password set with form fill) | Session B (everything typed) |
| --- | --- | --- |
| `input-trust` | **detected** — form fill fires untrusted `input`/`change` | clean — typing and clicks are trusted (CDP input) |
| `mouse-dynamics` | **detected** — exact-centre clicks, 0–1 moves | **detected** |
| `dom-mutations` | suspicious — an empty, attribute-less `<div>` appended to `<body>` ~0.9 s after load, 0×0, no open shadow root (likely a closed shadow-root host for the extension's UI — **hypothesis**) | suspicious — same `<div>` |
| `scroll-then-click` (new) | — | suspicious — unexplained scroll, click 64 ms later |
| `keyboard-dynamics` | clean at the time | 61 keys, **mean gap 6 ms** (people: 60–250 ms) → new superhuman-speed rule now marks it suspicious |
| `headless` | suspicious — outer window 0×0 at load (tab opened in a new background window) | clean |
| `honeypots` | not tried | **detected** after the new in-viewport trap: the agent found the `aria-hidden` 2×2 transparent button and clicked it (trusted events) |
| Silent | `webdriver`, `automation-globals`, `native-patches`, `cdp-console`, `sensitive-reads`, `capture-hints` | same |
| Score | 70, likely agent | 25 before the trap → 65 after |

Takeaways: the extension leaves a DOM footprint on every page (the empty `<div>`), types at machine speed, clicks element centres after scrolling them into view, and will act on elements that are hidden from assistive technology when a task leads it there. Reading the page (the sensitive table) left no trace in the main world, as expected.

**What the manifest says (Claude 1.0.102, ID `fcoeoabgfenejglbffodgkkbkcdhcgfn`).** It confirms most of the above:

- `permissions` include `debugger` → input and screenshots through CDP, hence trusted events everywhere.
- Content script `accessibility-tree.js` runs on `<all_urls>`, `all_frames`, at `document_start` → the page is read from an isolated world, invisible to `sensitive-reads`.
- Content script `agent-visual-indicator.js` runs on `<all_urls>` at `document_idle` → almost certainly the empty `<div>` host `dom-mutations` sees on every page.
- `web_accessible_resources` exposes both of those scripts to **every site** with `use_dynamic_url: false` → any page can `fetch()` them to learn the extension is installed. `extension-probe` now does this and reports **detected** in ~2 ms; a browser without the extension reports clean. The file names carry build hashes, so the configured paths must be refreshed on each extension release (a good fit for the planned `lists/`).

Caveat: installed is not active. This tells a site that the person *could* hand the page to an agent, not that one is acting now — combine it with the behavioural signals before responding.

### Fourth observation: automation frameworks (2026-10-24)

`tools/harness` runs the same task (type, fill, click, scrape the table from the main world) through each tool. Chrome 156 and Firefox are the ones installed on the machine; Playwright uses its own Chromium/WebKit builds. D detected · s suspicious · · clean · – unsupported.

| Detector | PW Chromium headless | PW Chromium headed | PW WebKit | Puppeteer Chrome | Puppeteer + stealth | Puppeteer Firefox (BiDi) | Selenium Chrome | Selenium Firefox |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| webdriver | D | D | D | D | · | D | D | D |
| automation-globals | · | · | · | · | · | · | D (`cdc_`) | · |
| headless | D | · | · | D | D (spoofed values) | · | D | · |
| permissions-consistency | D | · | · | · | D | · | · | · |
| cdp-console | · | · | D | · | · | · | · | · |
| input-trust | · | · | · | · | · | · | D (JS value set) | D |
| mouse-dynamics | D | D | D | D | D | D | D | D |
| keyboard-dynamics | s | s | s | s | s | s | s | s |
| scroll-then-click | · | · | s | s | s | s | s | s |
| sensitive-reads | D (stack marker) | D | s | D (stack marker) | D | D | s | s |
| **score** | **100** | **78** | **88** | **100** | **70** | **80** | **100** | **100** |

Findings:

- **Every framework is caught**, mostly by several independent detectors. `navigator.webdriver` alone catches everything except the stealth kit, including Firefox driven over WebDriver BiDi and Marionette.
- **Behaviour is universal.** `mouse-dynamics` fired for all eight runs and `keyboard-dynamics` (superhuman typing speed) for all eight: no framework moves the mouse or types like a person by default.
- **Main-world scraping is visible.** `page.evaluate` / `executeScript` reading the table tripped `sensitive-reads` in every run; Chromium-based Playwright and Puppeteer runs also left recognisable stack frames (detected), WebKit and Selenium did not (suspicious).
- **puppeteer-extra-plugin-stealth** hid `webdriver`, the HeadlessChrome UA and every native-function patch (its Proxy wrappers stringify as native, and its init scripts also reach script-created iframes, so the "pristine iframe" comparison does not help). It was caught by values no real browser produces: a non-ANGLE WebGL renderer ("Intel Iris OpenGL Engine" on an Apple M3) and a client-hint platform of "Mac OS X" (browsers send "macOS"), plus inconsistent notification permissions. `headless` now treats such impossible values as detected.
- **WebKit fires the console-serialisation probe** (`cdp-console`): its inspector protocol still invokes getters, unlike current Chromium.
- **Not run:** Playwright's patched Firefox build fails to start on this macOS version ("Could not find profile folder", even outside any sandbox). Firefox is covered by Puppeteer (BiDi) and Selenium (geckodriver) using the installed Firefox.

Still missing: human baselines. Every rule above has only been measured against machines.

## 5. Beyond the page: the layers that actually hold

Client-side detection alone cannot protect the data, because the data is already in the agent's browser by the time the page decides anything. The durable controls are:

1. **Declare policy.** Terms of service and `robots.txt` for crawlers. There is no settled standard yet for "agents acting for a user must not process this page"; watch the IETF work below and vendor site-blocklists.
2. **Identify well-behaved agents cryptographically.** *Web Bot Auth* has agents sign requests with HTTP Message Signatures (Ed25519 keys published at `/.well-known/http-message-signatures-directory`, `Signature-Agent` header). It tells you *who operates* the agent, not what it may do ([WorkOS](https://workos.com/blog/web-bot-auth-identify-ai-agents), [IETF architecture draft](https://datatracker.ietf.org/doc/html/draft-meunier-web-bot-auth-architecture), [protocol draft](https://www.ietf.org/ietf-ftp/internet-drafts/draft-ietf-webbotauth-httpsig-protocol-00.html)). Cloudflare uses it in its Verified Bots programme; whether the draft has been adopted by a working group is reported inconsistently ([Crawlbase](https://crawlbase.com/blog/web-bot-auth-signed-agents/)) — check the Datatracker. Signed agents can be blocked deterministically, which is far better than guessing. The lab server already logs `Signature-Agent`.
3. **Server-side signals.** TLS/HTTP2 fingerprints (JA4), header order, IP/ASN reputation, request pacing, session-level behaviour. Out of scope for v0, planned as `packages/server`.
4. **Minimise what is in the DOM.** The strongest defence for "very sensitive" fields: do not render them by default. Mask, reveal one field on demand, re-mask, rate-limit reveals, log every reveal server-side.
5. **Require human presence for reveals.** A WebAuthn assertion with user verification needs a physical touch or biometric. An agent can still ask the person to touch, but it can no longer bulk-harvest silently, and the person sees each request. This is the "step-up" responder in the roadmap.
6. **Make leaks traceable.** Per-session canary tokens (already in `honeypots`) and per-viewer watermarks on revealed data let you prove later that content was harvested.

About in-page "notices to agents" (text instructing AI agents to stop): reputable agents are trained to treat page content as untrusted and ignore such instructions, so this is unreliable as a control, and it is the same technique as prompt injection. A visible, plain-language policy notice is fine; hidden instructions are not a defence to build on.

## 6. Response options and their costs

| Response | Cost if wrong (false positive) | When it fits |
| --- | --- | --- |
| Log only | None | Always (v0) |
| Flag session server-side | Low | Score ≥ suspicious |
| Redact sensitive fields until re-verified | Low–medium: one extra step | Score ≥ likely, or any strong signal |
| Step-up: WebAuthn user verification | Medium: friction | Before revealing sensitive fields at any score on the most sensitive pages |
| Rate-limit reveals / exports | Low | Always on sensitive endpoints |
| Block the page | **High**: locks out assistive-tech users and wrongly flagged people | Only for deterministic signals (signed agent on a deny list, untrusted events on a sensitive action, honeypot hits) |

Rule of thumb: behaviour-based scores may *add friction*; only deterministic signals may *deny*.

## 7. Accessibility, privacy and law

- **Accessibility.** WCAG 2.2, the ADA (US) and the European Accessibility Act (applies from June 2025) make locking out assistive-technology users a legal risk, not only an ethical one. Every behavioural detector lists assistive tech in its limitations. Honeypots are `aria-hidden` and out of tab order. Responses must always offer a human path (step-up, support contact).
- **Privacy.** Keystroke timing and mouse dynamics are behavioural data; in some jurisdictions keystroke dynamics are treated as biometrics. The plugins keep timings and counts only — never key values or typed text — and the export contains no field values. Extension probing and fingerprinting are "accessing information on the terminal" under the EU ePrivacy rules; a security exemption may apply but needs a documented assessment (DPIA). Decide retention for `var/detections.log` before any production use.
- **Data in logs.** `describeNode` keeps identifying attributes only; text snippets are recorded only for nodes the page did not create.

## 8. Product direction: "uBlock for websites"

The uBlock analogy suggests the right split between code and data:

| uBlock Origin | anti-smith |
| --- | --- |
| Engine | `packages/core` runtime (scoring, event log, plugin contract) |
| Static filtering syntax | Plugin contract: detectors, responders, sinks |
| Filter lists (community data, updated often) | **Signal lists** (planned `lists/`): automation globals, stack markers, extension IDs, attribute patterns, renderer names — today they live in plugin `defaults` |
| Element hiding / redirect resources | Responder plugins (redact, step-up, notify) |
| Logger | Event log, sinks, the lab |

Distribution options (to decide later): a script tag or npm package for the page; server middleware that verifies Web Bot Auth and reads client results; a reverse-proxy injector for sites that cannot change code.

Client-side code will need hardening before production (integrity of the runtime itself, tamper detection, server-side verification of client results, not exposing the runtime on `window`). That is deliberately out of scope for the lab.

## 9. Open questions (each becomes an experiment)

1. Which mechanism does Claude for Chrome use for input, reading and screenshots on the current release — CDP via `chrome.debugger`, content scripts, or both? Does it inject a visible overlay into the page DOM? Does it act while the tab is unfocused?
2. Does any current Chrome still fire a console-serialisation getter under `Runtime.enable`? Which object shapes?
3. Does `Page.captureScreenshot` produce measurable animation-frame stalls (the in-app run suggests yes)? Is it distinguishable from main-thread jank?
4. What are the false-positive rates of `mouse-dynamics`, `keyboard-dynamics` and `focus-scroll` for macOS Voice Control, Windows Voice Access, Dragon and switch access?
5. Which agents read through the accessibility tree versus raw DOM? (Decides whether a11y-visible honeypots would be worth their accessibility cost — current answer: no.)
6. Can the server correlate client sessions with Web Bot Auth signatures and TLS fingerprints well enough to make client signals mostly confirmatory?

## Sources

- [Web Bot Auth: identify AI agents — WorkOS](https://workos.com/blog/web-bot-auth-identify-ai-agents)
- [IETF draft: HTTP Message Signatures for Bots (architecture)](https://datatracker.ietf.org/doc/html/draft-meunier-web-bot-auth-architecture)
- [IETF draft: webbotauth httpsig protocol](https://www.ietf.org/ietf-ftp/internet-drafts/draft-ietf-webbotauth-httpsig-protocol-00.html)
- [Crawlbase: Web Bot Auth signed agents](https://crawlbase.com/blog/web-bot-auth-signed-agents/)
- [Columbia Journalism Review: how AI browsers sneak past blockers and paywalls](https://cjr.org/analysis/how-ai-browsers-sneak-past-blockers-and-paywalls.php)
- [HUMAN Security: ChatGPT Atlas vs Perplexity Comet](https://humansecurity.com/learn/blog/chatgpt-atlas-vs-perplexity-comet-agentic-browsers/)
- [cside: guide to detecting AI agent traffic](https://cside.com/blog/guide-to-detect-ai-agent-traffic-on-your-website)
- [Decodo: ChatGPT Atlas and AI browsers bypassing detection](https://decodo.com/blog/chatgpt-atlas-ai-browsers-bypass-detection)
- [DataDome: new headless Chrome and the CDP signal](https://datadome.co/threat-research/how-new-headless-chrome-the-cdp-signal-are-impacting-bot-detection/)
- [Castle: why a classic CDP detection signal stopped working](https://blog.castle.io/why-a-classic-cdp-bot-detection-signal-suddenly-stopped-working-and-nobody-noticed/)
- [Scrappey: what is CDP detection](https://scrappey.com/qa/anti-bot/what-is-cdp-detection)
