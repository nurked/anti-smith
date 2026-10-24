import { test } from 'node:test';
import assert from 'node:assert/strict';
import { injectIntoHtml, bootstrapSnippet } from '../src/index.js';

const snippet = bootstrapSnippet({ autoUrl: '/auto.js', configUrl: '/site.json', inlineConfig: { config: { note: '</script>' } } });

test('the snippet goes before </head>, once', () => {
  const once = injectIntoHtml('<html><head><title>x</title></head><body>hi</body></html>', snippet);
  assert.ok(once.indexOf('id="anti-smith-config"') < once.indexOf('</head>'));
  assert.equal(injectIntoHtml(once, snippet), once);
});

test('without a head it goes after <body>, without either at the start', () => {
  assert.match(injectIntoHtml('<body class="a">hi</body>', snippet), /^<body class="a">\n<script/);
  assert.match(injectIntoHtml('hi', snippet), /^<script/);
});

test('inline JSON cannot close the script element', () => {
  assert.ok(!snippet.includes('</script>"'));
  assert.ok(snippet.includes('\\u003c/script>'));
});
