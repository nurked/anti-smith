/**
 * Tracks which DOM nodes belong to the page, so DOM-diff detectors can tell
 * the page's own changes from injected ones.
 *
 * Two mechanisms:
 *  - claimed nodes: every node present when the runtime starts, plus any node
 *    passed to `claim()` (plugins call `ctx.own(node)` before inserting it;
 *    host pages call `runtime.claim(node)`).
 *  - ignored subtrees: anything under an element with the ignore attribute
 *    (default `data-as-ignore`), e.g. the lab's own dashboard.
 */
const SHOW_ALL = 0xffffffff;

export function createOwnership(doc, { ignoreAttribute = 'data-as-ignore' } = {}) {
  const owned = new WeakSet();
  const ignoreSelector = `[${ignoreAttribute}]`;

  function claim(node) {
    if (!node) return node;
    owned.add(node);
    if (doc && typeof doc.createTreeWalker === 'function' && node.nodeType) {
      const walker = doc.createTreeWalker(node, SHOW_ALL);
      for (let current = walker.nextNode(); current; current = walker.nextNode()) owned.add(current);
    }
    return node;
  }

  function isIgnored(node) {
    const element = node?.nodeType === 1 ? node : node?.parentElement;
    return Boolean(element && typeof element.closest === 'function' && element.closest(ignoreSelector));
  }

  return {
    claim,
    isOwned: (node) => owned.has(node),
    isIgnored,
    snapshot() {
      if (doc?.documentElement) claim(doc.documentElement);
    },
  };
}
