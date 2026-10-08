export interface NavCounts {
  total: number;
  byFeed: Record<string, number>;
  byCategory: Record<string, number>;
  uncategorized: number;
}

export default function rollUpCounts(
  feedCounts: { feedId: string; count: number }[],
  subscriptions: { feedId: string; categoryId: string | null }[]
): NavCounts {
  const categoryOf = new Map(subscriptions.map(({ feedId, categoryId }) => [feedId, categoryId]));
  const counts: NavCounts = { total: 0, byFeed: {}, byCategory: {}, uncategorized: 0 };
  feedCounts.forEach(({ feedId, count }) => {
    if (!categoryOf.has(feedId)) return;
    const categoryId = categoryOf.get(feedId);
    counts.total += count;
    counts.byFeed[feedId] = count;
    if (categoryId) counts.byCategory[categoryId] = (counts.byCategory[categoryId] ?? 0) + count;
    else counts.uncategorized += count;
  });
  return counts;
}
