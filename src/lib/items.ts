import 'server-only';
import prisma from '@/lib/db';

export async function feedsToRefresh(userId: string) {
  const now = new Date();
  const subscriptions = await prisma.subscription.findMany({
    where: { userId },
    select: { feed: { select: { id: true, lastFetchedAt: true, nextFetchAt: true } } },
  });
  const feeds = subscriptions.map(({ feed }) => feed);
  return {
    neverFetched: feeds.filter(({ lastFetchedAt }) => !lastFetchedAt).map(({ id }) => id),
    due: feeds
      .filter(({ lastFetchedAt, nextFetchAt }) => lastFetchedAt && nextFetchAt <= now)
      .map(({ id }) => id),
  };
}

export function listItems(userId: string, take = 50) {
  return prisma.item.findMany({
    where: { feed: { subscriptions: { some: { userId } } } },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    take,
    select: {
      id: true,
      title: true,
      url: true,
      excerpt: true,
      publishedAt: true,
      feed: { select: { title: true, iconUrl: true } },
    },
  });
}

export type ListedItem = Awaited<ReturnType<typeof listItems>>[number];
