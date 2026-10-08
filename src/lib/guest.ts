import 'server-only';
import prisma from '@/lib/db';
import sampleFeeds from '../../data/sample-feeds.json';

export default async function seedGuest(userId: string) {
  const feeds = sampleFeeds.categories.flatMap((category) => category.feeds);
  await prisma.feed.createMany({
    data: feeds.map(({ feedUrl, title, siteUrl, description }) => ({
      url: feedUrl,
      title,
      siteUrl,
      description,
    })),
    skipDuplicates: true,
  });
  const stored = await prisma.feed.findMany({
    where: { url: { in: feeds.map(({ feedUrl }) => feedUrl) } },
    select: { id: true, url: true },
  });
  const feedIds = new Map(stored.map(({ id, url }) => [url, id]));

  await Promise.all(
    sampleFeeds.categories.map(async ({ name, feeds: categoryFeeds }, position) => {
      const category = await prisma.category.upsert({
        where: { userId_name: { userId, name } },
        create: { userId, name, position },
        update: {},
      });
      await prisma.subscription.createMany({
        data: categoryFeeds.flatMap(({ feedUrl }) => {
          const feedId = feedIds.get(feedUrl);
          return feedId ? [{ userId, feedId, categoryId: category.id }] : [];
        }),
        skipDuplicates: true,
      });
    })
  );
}
