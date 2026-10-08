import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cleanText, firstImage, httpUrl, sanitizeContent, toExcerpt, toPlainText } from './html.ts';

const BASE = 'https://ex.com/posts/1';

test('sanitizeContent removes scripts, handlers and javascript: links', () => {
  const out = sanitizeContent(
    '<p onclick="x()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src="a.png" onerror="x()">',
    BASE
  );
  assert.doesNotMatch(out, /script|onclick|onerror|javascript:/i);
  assert.match(out, /<p>Hi<\/p>/);
  assert.match(out, /src="https:\/\/ex\.com\/posts\/a\.png"/);
});

test('sanitizeContent demotes h1 and keeps only language-* classes on code', () => {
  const out = sanitizeContent('<h1>T</h1><pre><code class="language-js hljs">x</code></pre>', BASE);
  assert.match(out, /<h2>T<\/h2>/);
  assert.match(out, /<code class="language-js">x<\/code>/);
});

test('sanitizeContent strips tracking pixels, ads and navigation', () => {
  const out = sanitizeContent(
    '<img src="https://medium.com/_/stat?event=x" width="1" height="1"><div class="ad-banner">Buy</div><nav>Menu</nav><header class="post-header"><p>Body</p></header>',
    BASE
  );
  assert.equal(out, '<p>Body</p>');
});

test('sanitizeContent makes links absolute and safe, images lazy', () => {
  const out = sanitizeContent('<a href="/x">x</a><img src="//cdn.ex.com/i.png" alt="A">', BASE);
  assert.match(out, /href="https:\/\/ex\.com\/x"/);
  assert.match(out, /rel="noopener noreferrer"/);
  assert.match(out, /target="_blank"/);
  assert.match(out, /src="https:\/\/cdn\.ex\.com\/i\.png"/);
  assert.match(out, /loading="lazy"/);
});

test('toPlainText separates blocks and decodes entities', () => {
  assert.equal(
    toPlainText('<p>Hello&nbsp;<b>world</b> &amp; co</p><p>Next</p>'),
    'Hello world & co Next'
  );
});

test('toExcerpt truncates on a word boundary', () => {
  const excerpt = toExcerpt(`<p>${'word '.repeat(100)}</p>`, 20);
  assert.ok(excerpt.endsWith('…'));
  assert.ok(excerpt.length <= 21);
  assert.equal(toExcerpt('<p>short</p>'), 'short');
});

test('cleanText decodes entities but keeps literal angle brackets', () => {
  assert.equal(
    cleanText('Tips &amp; tricks &mdash; CSS&#8217;s   <dialog>'),
    'Tips & tricks — CSS’s <dialog>'
  );
});

test('firstImage and httpUrl only return http(s) URLs', () => {
  assert.equal(
    firstImage('<p>x</p><img src="https://ex.com/a.png?x=1&amp;y=2">'),
    'https://ex.com/a.png?x=1&y=2'
  );
  assert.equal(firstImage('<p>none</p>'), null);
  assert.equal(httpUrl('/a', 'https://ex.com/b'), 'https://ex.com/a');
  assert.equal(httpUrl('javascript:alert(1)'), null);
  assert.equal(httpUrl('not a url'), null);
  assert.equal(httpUrl(null), null);
});
