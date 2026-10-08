import assert from 'node:assert/strict';
import { test } from 'node:test';
import discoverFeedUrls from './discover.ts';

test('discoverFeedUrls finds RSS and Atom alternates as absolute URLs in document order', () => {
  const html = `<html><head>
    <link rel="stylesheet" href="/style.css">
    <LINK REL="Alternate" TYPE="application/rss+xml" HREF="/feed.xml">
    <link rel="alternate feed" type="application/atom+xml" href="https://example.com/atom">
    <link rel="alternate" type="application/rss+xml" href="/feed.xml">
    <link rel="alternate" type="text/html" href="/fr">
    <link rel="alternate" type="application/rss+xml" href="javascript:alert(1)">
  </head><body></body></html>`;
  assert.deepEqual(discoverFeedUrls(html, 'https://example.com/blog/'), [
    'https://example.com/feed.xml',
    'https://example.com/atom',
  ]);
});

test('discoverFeedUrls returns an empty list when there are no alternates', () => {
  assert.deepEqual(discoverFeedUrls('<p>hello</p>', 'https://example.com'), []);
});
