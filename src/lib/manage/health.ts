import { type FeedHealth, type FeedHealthInput, feedHealth } from '../feeds/health.ts';

export default function summarizeHealth(
  feeds: FeedHealthInput[],
  now: Date
): Record<FeedHealth, number> {
  const summary: Record<FeedHealth, number> = {
    active: 0,
    stale: 0,
    error: 0,
    dead: 0,
    pending: 0,
  };
  feeds.forEach((feed) => {
    summary[feedHealth(feed, now)] += 1;
  });
  return summary;
}
