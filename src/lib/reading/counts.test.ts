import assert from 'node:assert/strict';
import { test } from 'node:test';
import rollUpCounts from './counts.ts';

test('rollUpCounts sums per feed into categories, uncategorized and total', () => {
  const counts = rollUpCounts(
    [
      { feedId: 'a', count: 3 },
      { feedId: 'b', count: 4 },
      { feedId: 'c', count: 5 },
      { feedId: 'gone', count: 100 },
    ],
    [
      { feedId: 'a', categoryId: 'frontend' },
      { feedId: 'b', categoryId: 'frontend' },
      { feedId: 'c', categoryId: null },
      { feedId: 'd', categoryId: 'design' },
    ]
  );
  assert.deepEqual(counts, {
    total: 12,
    byFeed: { a: 3, b: 4, c: 5 },
    byCategory: { frontend: 7 },
    uncategorized: 5,
  });
});
