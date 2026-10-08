import assert from 'node:assert/strict';
import { test } from 'node:test';
import { feedHealth, nextFetchAt } from './health.ts';

const now = new Date('2026-10-08T12:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
const healthy = {
  lastSuccessAt: now,
  latestItemAt: daysAgo(1),
  failCount: 0,
  errorPermanent: false,
};

test('feedHealth', () => {
  assert.equal(feedHealth(healthy, now), 'active');
  assert.equal(feedHealth({ ...healthy, lastSuccessAt: null, latestItemAt: null }, now), 'pending');
  assert.equal(feedHealth({ ...healthy, latestItemAt: daysAgo(31) }, now), 'stale');
  assert.equal(feedHealth({ ...healthy, latestItemAt: null }, now), 'stale');
  assert.equal(feedHealth({ ...healthy, failCount: 1 }, now), 'error');
  assert.equal(feedHealth({ ...healthy, failCount: 2, errorPermanent: true }, now), 'error');
  assert.equal(feedHealth({ ...healthy, failCount: 3, errorPermanent: true }, now), 'dead');
  assert.equal(feedHealth({ ...healthy, failCount: 10 }, now), 'dead');
});

test('nextFetchAt backs off exponentially and caps at 24 hours', () => {
  const minutes = (failCount: number) =>
    (nextFetchAt(failCount, now).getTime() - now.getTime()) / 60_000;
  assert.equal(minutes(0), 15);
  assert.equal(minutes(1), 15);
  assert.equal(minutes(2), 30);
  assert.equal(minutes(3), 60);
  assert.equal(minutes(10), 24 * 60);
});
