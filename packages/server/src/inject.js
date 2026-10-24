/**
 * Edge / reverse-proxy integration: add anti-smith to HTML responses without
 * changing the application. The snippet goes right before </head> (or at the
 * start of <body>, or at the very start if neither tag is present), and only
 * once — a page that already carries the config block is left alone.
 */
export function injectIntoHtml(html, snippet, { marker = 'id="anti-smith-config"' } = {}) {
  const page = String(html);
  if (page.includes(marker)) return page;
  const head = page.search(/<\/head\s*>/i);
  if (head >= 0) return `${page.slice(0, head)}${snippet}\n${page.slice(head)}`;
  const body = page.search(/<body[^>]*>/i);
  if (body >= 0) {
    const end = page.indexOf('>', body) + 1;
    return `${page.slice(0, end)}\n${snippet}${page.slice(end)}`;
  }
  return `${snippet}\n${page}`;
}

/** The standard bootstrap snippet: a config block (inline JSON and/or a shared config URL) plus auto.js. */
export function bootstrapSnippet({ autoUrl, configUrl = null, inlineConfig = null }) {
  const src = configUrl ? ` data-src="${escapeAttribute(configUrl)}"` : '';
  // "</" cannot appear inside the JSON, or the browser would end the script element early.
  const json = inlineConfig ? JSON.stringify(inlineConfig).replace(/</g, '\\u003c') : '';
  return `<script type="application/json" id="anti-smith-config"${src}>${json}</script>\n<script type="module" src="${escapeAttribute(autoUrl)}"></script>`;
}

function escapeAttribute(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
