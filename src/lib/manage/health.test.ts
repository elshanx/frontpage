import assert from 'node:assert/strict';
import { test } from 'node:test';
import summarizeHealth from './health.ts';

test('summarizeHealth counts feeds per health status', () => {
  const now = new Date('2026-10-08T12:00:00.000Z');
  const recent = new Date('2026-10-07T12:00:00.000Z');
  const old = new Date('2026-01-01T00:00:00.000Z');
  const ok = { lastSuccessAt: recent, latestItemAt: recent, failCount: 0, errorPermanent: false };
  assert.deepEqual(
    summarizeHealth(
      [
        ok,
        ok,
        { ...ok, latestItemAt: old },
        { ...ok, failCount: 1 },
        { ...ok, failCount: 10 },
        { ...ok, lastSuccessAt: null },
      ],
      now
    ),
    { active: 2, stale: 1, error: 1, dead: 1, pending: 1 }
  );
});
