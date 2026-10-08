import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FeedParseError, parseFeed } from './parse.ts';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>CSS &amp;amp; Tricks</title>
  <link>https://example.com/</link>
  <description>Tips &amp; tricks</description>
  <image><url>https://example.com/icon.png</url></image>
  <item>
    <title>Grid&#8217;s new &amp;mdash; tricks</title>
    <link>/posts/grid</link>
    <guid isPermaLink="false">post-1</guid>
    <dc:creator>Ana</dc:creator>
    <pubDate>Mon, 15 Jan 2024 10:30:00 GMT</pubDate>
    <description>&lt;p&gt;Short summary&lt;/p&gt;</description>
    <content:encoded><![CDATA[<p>Full <strong>body</strong></p><img src="/img/hero.png" alt="Hero"><script>alert(1)</script>]]></content:encoded>
  </item>
  <item><title>Only a title</title></item>
  <item>
    <description>No title here but there is text</description>
    <guid>https://example.com/posts/3</guid>
  </item>
  <item>
    <title>With enclosure</title>
    <link>javascript:alert(1)</link>
    <enclosure url="https://cdn.example.com/a.jpg" type="image/jpeg" length="1"/>
  </item>
</channel>
</rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title type="html">Simon &lt;em&gt;Willison&lt;/em&gt;</title>
  <subtitle>Notes</subtitle>
  <link href="https://simon.example/atom/" rel="self"/>
  <link href="https://simon.example/" rel="alternate"/>
  <icon>/favicon.ico</icon>
  <entry>
    <title>The &lt;dialog&gt; element</title>
    <link href="https://simon.example/2024/dialog/" rel="alternate"/>
    <id>tag:simon.example,2024:1</id>
    <updated>2024-01-16T00:00:00Z</updated>
    <published>2024-01-15T10:30:00+02:00</published>
    <author><name>Simon</name></author>
    <summary type="html">&lt;p&gt;A summary&lt;/p&gt;</summary>
    <content type="xhtml"><div xmlns="http://www.w3.org/1999/xhtml"><p>Full <code>dialog</code> post</p></div></content>
  </entry>
  <entry>
    <title>Updated only</title>
    <id>tag:2</id>
    <updated>2024-02-01T00:00:00Z</updated>
    <content type="html">&lt;p&gt;Body &lt;a href="javascript:alert(1)"&gt;x&lt;/a&gt;&lt;/p&gt;</content>
  </entry>
</feed>`;

const RDF = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel rdf:about="https://rdf.example/">
    <title>RDF Site</title><link>https://rdf.example/</link><description>Old school</description>
  </channel>
  <item rdf:about="https://rdf.example/1">
    <title>First RDF</title><link>https://rdf.example/1</link>
    <dc:date>2024-01-15T10:30:00Z</dc:date><description>Hello</description>
  </item>
</rdf:RDF>`;

test('parses RSS 2.0 channel metadata', () => {
  const feed = parseFeed(RSS);
  assert.equal(feed.format, 'rss2');
  assert.equal(feed.title, 'CSS & Tricks');
  assert.equal(feed.siteUrl, 'https://example.com/');
  assert.equal(feed.description, 'Tips & tricks');
  assert.equal(feed.iconUrl, 'https://example.com/icon.png');
  assert.equal(feed.items.length, 4);
});

test('parses a full RSS 2.0 item', () => {
  const [item] = parseFeed(RSS).items;
  assert.equal(item.title, 'Grid’s new — tricks');
  assert.equal(item.url, 'https://example.com/posts/grid');
  assert.equal(item.guid, 'post-1');
  assert.equal(item.author, 'Ana');
  assert.equal(item.publishedAt?.toISOString(), '2024-01-15T10:30:00.000Z');
  assert.equal(item.excerpt, 'Short summary');
  assert.match(item.contentHtml ?? '', /<strong>body<\/strong>/);
  assert.doesNotMatch(item.contentHtml ?? '', /script/);
  assert.equal(item.imageUrl, 'https://example.com/img/hero.png');
});

test('handles RSS items with missing optional fields', () => {
  const [, onlyTitle, noTitle, enclosure] = parseFeed(RSS).items;
  assert.deepEqual(onlyTitle, {
    guid: null,
    url: null,
    title: 'Only a title',
    author: null,
    publishedAt: null,
    excerpt: '',
    contentHtml: null,
    imageUrl: null,
  });
  assert.equal(noTitle.title, 'No title here but there is text');
  assert.equal(noTitle.url, 'https://example.com/posts/3');
  assert.equal(noTitle.contentHtml, null);
  assert.equal(enclosure.url, null);
  assert.equal(enclosure.imageUrl, 'https://cdn.example.com/a.jpg');
});

test('parses Atom 1.0', () => {
  const feed = parseFeed(ATOM);
  assert.equal(feed.format, 'atom');
  assert.equal(feed.title, 'Simon Willison');
  assert.equal(feed.siteUrl, 'https://simon.example/');
  assert.equal(feed.description, 'Notes');
  assert.equal(feed.iconUrl, 'https://simon.example/favicon.ico');

  const [entry, updatedOnly] = feed.items;
  assert.equal(entry.title, 'The <dialog> element');
  assert.equal(entry.url, 'https://simon.example/2024/dialog/');
  assert.equal(entry.guid, 'tag:simon.example,2024:1');
  assert.equal(entry.author, 'Simon');
  assert.equal(entry.publishedAt?.toISOString(), '2024-01-15T08:30:00.000Z');
  assert.equal(entry.excerpt, 'A summary');
  assert.match(entry.contentHtml ?? '', /<code>dialog<\/code>/);

  assert.equal(updatedOnly.publishedAt?.toISOString(), '2024-02-01T00:00:00.000Z');
  assert.doesNotMatch(updatedOnly.contentHtml ?? '', /javascript:/);
});

test('parses RSS 1.0 / RDF', () => {
  const feed = parseFeed(RDF);
  assert.equal(feed.format, 'rdf');
  assert.equal(feed.title, 'RDF Site');
  assert.equal(feed.items[0].guid, 'https://rdf.example/1');
  assert.equal(feed.items[0].url, 'https://rdf.example/1');
  assert.equal(feed.items[0].publishedAt?.toISOString(), '2024-01-15T10:30:00.000Z');
});

test('partially parses truncated XML with bare ampersands', () => {
  const feed = parseFeed(
    '<rss><channel><title>Tom & Jerry</title><item><title>First</title><link>https://x.example/1</link></item><item><title>Sec'
  );
  assert.equal(feed.title, 'Tom & Jerry');
  assert.equal(feed.items[0].title, 'First');
  assert.equal(feed.items.length, 1);
});

test('drops the cut-off last item from truncated Atom and RDF', () => {
  assert.equal(
    parseFeed('<feed><entry><title>A</title><id>1</id></entry><entry><title>B</title><summary>half')
      .items.length,
    1
  );
});

test('keeps every item when a comment trails the root element', () => {
  const feed = parseFeed(
    '<rss><channel><item><title>A</title></item><item><title>B</title></item></channel></rss>\n<!-- cached at 12:00 -->\n'
  );
  assert.equal(feed.items.length, 2);
});

test('strips NUL characters that Postgres rejects', () => {
  const [item] = parseFeed(
    '<rss><channel><item><title>Bad\u0000title</title><description>&lt;p&gt;x\u0000y&lt;/p&gt;</description></item></channel></rss>'
  ).items;
  assert.equal(item.title, 'Badtitle');
  assert.equal(item.excerpt, 'xy');
});

test('accepts a valid feed with no items', () => {
  assert.deepEqual(parseFeed('<rss><channel><title>Quiet</title></channel></rss>').items, []);
});

test('rejects web pages and non-feeds with clear messages', () => {
  assert.throws(
    () => parseFeed('<!doctype html><html><head><title>Hi</title></head><body></body></html>'),
    (error) => error instanceof FeedParseError && /web page, not a feed/.test(error.message)
  );
  assert.throws(() => parseFeed('not xml at all'), /RSS or Atom/);
  assert.throws(() => parseFeed('{"version":"https://jsonfeed.org/version/1"}'), /RSS or Atom/);
  assert.throws(() => parseFeed(''), FeedParseError);
});
