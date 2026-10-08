export type FeedHealth = 'pending' | 'active' | 'stale' | 'error' | 'dead';

export interface FeedHealthInput {
  lastSuccessAt: Date | null;
  latestItemAt: Date | null;
  failCount: number;
  errorPermanent: boolean;
}

export const REFRESH_INTERVAL_MS = 15 * 60_000;
const STALE_AFTER_MS = 30 * 86_400_000;
const MAX_BACKOFF_MS = 24 * 3_600_000;
const DEAD_AFTER_FAILURES = 10;
const DEAD_AFTER_PERMANENT_FAILURES = 3;

export function feedHealth(feed: FeedHealthInput, now: Date): FeedHealth {
  const isDead =
    feed.failCount >= DEAD_AFTER_FAILURES ||
    (feed.errorPermanent && feed.failCount >= DEAD_AFTER_PERMANENT_FAILURES);
  if (isDead) return 'dead';
  if (feed.failCount > 0) return 'error';
  if (!feed.lastSuccessAt) return 'pending';
  if (!feed.latestItemAt || now.getTime() - feed.latestItemAt.getTime() > STALE_AFTER_MS) {
    return 'stale';
  }
  return 'active';
}

export function nextFetchAt(failCount: number, now: Date): Date {
  const delay =
    failCount === 0
      ? REFRESH_INTERVAL_MS
      : Math.min(REFRESH_INTERVAL_MS * 2 ** (failCount - 1), MAX_BACKOFF_MS);
  return new Date(now.getTime() + delay);
}
