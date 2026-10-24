/**
 * Short, privacy-safe description of a DOM node for evidence and logs.
 *
 * By default only identifying attributes are kept, never text or values: the
 * lab is about sensitive pages and the logs must not become a copy of them.
 * `snippet: true` adds all attributes and a truncated outerHTML; use it only
 * for nodes the page did not create (injected overlays, scripts, iframes).
 */
const SAFE_ATTRIBUTES = ['id', 'class', 'name', 'type', 'role', 'href', 'aria-label', 'data-as-trap'];

export function describeNode(node, { snippet = false, snippetChars = 200 } = {}) {
  if (!node) return null;
  if (node.nodeType === 3) return { node: '#text', length: String(node.data ?? '').length };
  if (node.nodeType !== 1) return { node: node.nodeName ?? String(node) };

  const attrs = {};
  for (const attr of Array.from(node.attributes ?? []).slice(0, 16)) {
    if (snippet || SAFE_ATTRIBUTES.includes(attr.name) || attr.name.startsWith('data-as-')) {
      attrs[attr.name] = String(attr.value).slice(0, 120);
    }
  }
  const description = { tag: String(node.tagName).toLowerCase(), attrs };
  if (snippet) {
    try {
      description.snippet = String(node.outerHTML ?? '').slice(0, snippetChars);
    } catch {
      description.snippet = null;
    }
  }
  return description;
}
