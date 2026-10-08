import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import buildOpml from './build.ts';
import parseOpml, { OpmlError } from './parse.ts';
import planImport from './plan.ts';

const sample = readFileSync(new URL('../../../data/sample-feeds.opml', import.meta.url), 'utf8');

test('parseOpml handles every edge case in the sample file', () => {
  const entries = parseOpml(sample);
  assert.equal(entries.length, 25);
  const find = (title: string) => entries.find((entry) => entry.title === title);
  assert.deepEqual(find('CSS-Tricks (alt attr)'), {
    url: 'https://css-tricks.com/feed/',
    title: 'CSS-Tricks (alt attr)',
    category: null,
  });
  assert.equal(find('web.dev (no type)')?.url, 'https://web.dev/feed.xml');
  assert.equal(find('Smashing (nested)')?.category, 'Nested Category / Subcategory');
  assert.equal(find("Simon Willison's Weblog")?.category, 'AI & ML');
  assert.deepEqual(entries.at(-1), {
    url: 'https://blog.cloudflare.com/rss/',
    title: null,
    category: null,
  });
});

test('parseOpml rejects documents without an OPML body', () => {
  assert.throws(() => parseOpml('<html><p>hi</p></html>'), OpmlError);
});

test('planImport flags in-file duplicates and existing subscriptions', () => {
  const entries = parseOpml(sample);
  const statuses = (rows: { status: string }[]) =>
    rows.reduce<Record<string, number>>(
      (counts, { status }) => ({ ...counts, [status]: (counts[status] ?? 0) + 1 }),
      {}
    );
  assert.deepEqual(statuses(planImport(entries, [])), { new: 20, duplicate: 5 });
  const rows = planImport(entries, ['https://simonwillison.net/atom/everything/']);
  assert.deepEqual(statuses(rows), { new: 19, duplicate: 5, subscribed: 1 });
  assert.equal(rows.find(({ title }) => title === "Simon Willison's Weblog")?.status, 'subscribed');
});

test('buildOpml escapes attributes and round-trips through parseOpml', () => {
  const xml = buildOpml(
    [
      {
        name: 'A & "B" <C>',
        feeds: [{ title: 'Tom & Jerry', url: 'https://x.test/feed?a=1&b=2', siteUrl: null }],
      },
      {
        name: null,
        feeds: [{ title: 'Root', url: 'https://y.test/rss', siteUrl: 'https://y.test' }],
      },
    ],
    'Frontpage'
  );
  assert.ok(!xml.includes('a=1&b=2'));
  assert.deepEqual(parseOpml(xml), [
    { url: 'https://x.test/feed?a=1&b=2', title: 'Tom & Jerry', category: 'A & "B" <C>' },
    { url: 'https://y.test/rss', title: 'Root', category: null },
  ]);
});
