/**
 * Sets this page's protection level before anything else runs:
 *   <html data-as-protection="0|1|2|3">
 * from ?level=0..3 (remembered in this browser), ?level=default (forget), or the
 * page's own default (data-default-protection on <html>).
 *
 * Protection responders read the attribute: 1 banner, 2 + content lockout, 3 + agent notice.
 *
 * Same for the score threshold at which they engage: ?threshold=N (remembered), ?threshold=default
 * → <html data-as-threshold="N">. Without it, each responder's configured threshold (40) applies.
 * Classic (non-module) script on purpose: it must run synchronously in <head>.
 */
(function () {
  var root = document.documentElement;
  var query = new URLSearchParams(location.search).get('level');
  try {
    if (query === 'default') localStorage.removeItem('crm-protection-level');
    else if (query !== null) localStorage.setItem('crm-protection-level', query);
  } catch (e) {
    // storage blocked: the query and page default still work
  }
  var stored = null;
  try {
    stored = localStorage.getItem('crm-protection-level');
  } catch (e) {}
  var chosen = query !== null && query !== 'default' ? query : stored !== null ? stored : root.getAttribute('data-default-protection');
  var level = Math.max(0, Math.min(3, Number(chosen) || 0));
  root.setAttribute('data-as-protection', String(level));
  root.setAttribute('data-level-source', query !== null && query !== 'default' ? 'query' : stored !== null ? 'remembered' : 'page default');

  var t = new URLSearchParams(location.search).get('threshold');
  try {
    if (t === 'default') localStorage.removeItem('crm-protection-threshold');
    else if (t !== null) localStorage.setItem('crm-protection-threshold', t);
    t = localStorage.getItem('crm-protection-threshold');
  } catch (e) {
    if (t === 'default') t = null;
  }
  if (t !== null && Number(t) > 0) root.setAttribute('data-as-threshold', String(Number(t)));
})();
