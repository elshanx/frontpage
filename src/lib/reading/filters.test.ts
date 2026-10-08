import assert from 'node:assert/strict';
import { test } from 'node:test';
import { type ListFilter, filterToSearch, parseListFilter } from './filters.ts';

const roundTrip = (filter: ListFilter) =>
  parseListFilter(Object.fromEntries(new URLSearchParams(filterToSearch(filter))));

test('filterToSearch and parseListFilter round-trip every filter shape', () => {
  const filters: ListFilter[] = [
    { kind: 'all', unreadOnly: false },
    { kind: 'all', unreadOnly: true },
    { kind: 'category', id: 'cat-1', unreadOnly: false },
    { kind: 'category', id: null, unreadOnly: true },
    { kind: 'feed', id: 'feed_2', unreadOnly: true },
  ];
  filters.forEach((filter) => assert.deepEqual(roundTrip(filter), filter));
  assert.equal(filterToSearch({ kind: 'all', unreadOnly: false }), '');
});

test('parseListFilter prefers feed over category and takes the first array value', () => {
  assert.deepEqual(parseListFilter({ feed: 'f1', category: 'c1' }), {
    kind: 'feed',
    id: 'f1',
    unreadOnly: false,
  });
  assert.deepEqual(parseListFilter({ category: ['c1', 'c2'], show: 'unread' }), {
    kind: 'category',
    id: 'c1',
    unreadOnly: true,
  });
});

test('parseListFilter falls back to all items for malformed ids', () => {
  ['../x', 'a'.repeat(65), ''].forEach((id) =>
    assert.deepEqual(parseListFilter({ feed: id }), { kind: 'all', unreadOnly: false }, id)
  );
  assert.deepEqual(parseListFilter({ show: 'everything' }), { kind: 'all', unreadOnly: false });
});
