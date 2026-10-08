import assert from 'node:assert/strict';
import { test } from 'node:test';
import { latestPublished, MAX_ITEMS_PER_FETCH, toItemRows } from './ingest.ts';
import type { ParsedItem } from './parse.ts';

const fetchedAt = new Date('2026-10-08T12:00:00Z');
const item = (overrides: Partial<ParsedItem>): ParsedItem => ({
  guid: null,
  url: null,
  title: 'T',
  author: null,
  publishedAt: null,
  excerpt: '',
  contentHtml: null,
  imageUrl: null,
  ...overrides,
});

test('guid falls back to url, then a stable hash of title and date', () => {
  const [byGuid, byUrl, byHash, sameHash] = toItemRows(
    'f',
    [
      item({ guid: 'g', url: 'https://x/1' }),
      item({ url: 'https://x/2' }),
      item({ title: 'Hello' }),
      item({ title: 'Hello' }),
    ],
    fetchedAt
  );
  assert.equal(byGuid.guid, 'g');
  assert.equal(byUrl.guid, 'https://x/2');
  assert.match(byHash.guid, /^[0-9a-f]{40}$/);
  assert.equal(byHash.guid, sameHash.guid);
});

test('missing and future dates become the fetch time', () => {
  const [missing, future, past] = toItemRows(
    'f',
    [
      item({}),
      item({ publishedAt: new Date('2030-01-01T00:00:00Z') }),
      item({ publishedAt: new Date('2024-01-01T00:00:00Z') }),
    ],
    fetchedAt
  );
  assert.equal(missing.publishedAt, fetchedAt);
  assert.equal(future.publishedAt, fetchedAt);
  assert.equal(past.publishedAt.toISOString(), '2024-01-01T00:00:00.000Z');
});

test('caps rows per fetch and finds the latest date', () => {
  const rows = toItemRows(
    'f',
    Array.from({ length: 250 }, (_, i) => item({ guid: String(i) })),
    fetchedAt
  );
  assert.equal(rows.length, MAX_ITEMS_PER_FETCH);
  assert.equal(latestPublished(rows), fetchedAt);
  assert.equal(latestPublished([]), null);
});
