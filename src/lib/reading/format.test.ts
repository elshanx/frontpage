import assert from 'node:assert/strict';
import { test } from 'node:test';
import { badgeCount, relativeTime } from './format.ts';

const now = new Date('2026-10-08T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test('relativeTime uses short relative buckets for the last week', () => {
  assert.equal(relativeTime(ago(20_000), now), 'just now');
  assert.equal(relativeTime(ago(5 * MINUTE), now), '5m ago');
  assert.equal(relativeTime(ago(3 * HOUR), now), '3h ago');
  assert.equal(relativeTime(ago(DAY + HOUR), now), 'yesterday');
  assert.equal(relativeTime(ago(4 * DAY), now), '4d ago');
});

test('relativeTime falls back to a date, adding the year only when it differs', () => {
  assert.equal(relativeTime(new Date('2026-03-03T12:00:00.000Z'), now), 'Mar 3');
  assert.equal(relativeTime(new Date('2025-03-03T12:00:00.000Z'), now), 'Mar 3, 2025');
});

test('relativeTime treats future dates as just now', () => {
  assert.equal(relativeTime(new Date(now.getTime() + HOUR), now), 'just now');
});

test('badgeCount hides zero and caps at 99+', () => {
  assert.deepEqual([0, 7, 99, 100, 5000].map(badgeCount), ['', '7', '99', '99+', '99+']);
});
