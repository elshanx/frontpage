import assert from 'node:assert/strict';
import { test } from 'node:test';
import rankDigest, { type DigestCandidate, digestWindowStart } from './rank.ts';

const now = new Date('2026-10-09T12:00:00Z');
const HOUR = 3_600_000;

const item = (id: string, feedId: string, hoursAgo: number, categoryId: string | null = 'c1') =>
  ({
    id,
    feedId,
    categoryId,
    publishedAt: new Date(now.getTime() - hoursAgo * HOUR),
  }) satisfies DigestCandidate;

const many = (count: number, feedId: string, categoryId: string | null = 'c1') =>
  Array.from({ length: count }, (_, i) => item(`${feedId}-${i}`, feedId, i, categoryId));

test('quiet days return everything newest first', () => {
  const result = rankDigest([item('a', 'f1', 5), item('b', 'f2', 1)], {}, now);
  assert.equal(result.kind, 'quiet');
  assert.deepEqual(result.kind === 'quiet' && result.items.map(({ id }) => id), ['b', 'a']);
});

test('busy days cap each feed at 2 and each group at 5 with a remainder', () => {
  const items = [...many(6, 'f1'), ...many(3, 'f2'), ...many(3, 'f3'), ...many(3, 'f4')];
  const result = rankDigest(items, {}, now);
  assert.equal(result.kind, 'ranked');
  if (result.kind !== 'ranked') return;
  const [group] = result.groups;
  assert.equal(group.items.length, 5);
  const perFeed = Object.groupBy(group.items, ({ feedId }) => feedId);
  Object.values(perFeed).forEach((list) => assert.ok((list?.length ?? 0) <= 2));
  assert.equal(group.more, items.length - 5);
});

test('rare sources outrank high-volume ones at equal age', () => {
  const items = [...many(4, 'busy'), item('rare-0', 'rare', 0), ...many(4, 'f3')];
  const result = rankDigest(items, { busy: 200, rare: 1, f3: 50 }, now);
  assert.ok(result.kind === 'ranked' && result.groups[0].items[0].id === 'rare-0');
});

test('groups keep categories apart, uncategorized as null', () => {
  const items = [...many(5, 'f1', 'c1'), ...many(5, 'f2', null)];
  const result = rankDigest(items, {}, now);
  assert.ok(result.kind === 'ranked');
  if (result.kind !== 'ranked') return;
  assert.deepEqual(result.groups.map(({ categoryId }) => categoryId).sort(), ['c1', null].sort());
});

test('digestWindowStart resolves each window', () => {
  const seen = new Date(now.getTime() - 3 * HOUR);
  assert.deepEqual(digestWindowStart('since', seen, now), seen);
  assert.deepEqual(digestWindowStart('since', null, now), new Date(now.getTime() - 24 * HOUR));
  assert.deepEqual(digestWindowStart('day', seen, now), new Date(now.getTime() - 24 * HOUR));
  assert.deepEqual(digestWindowStart('week', seen, now), new Date(now.getTime() - 168 * HOUR));
});
