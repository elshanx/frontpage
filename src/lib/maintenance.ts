import 'server-only';
import prisma from '@/lib/db';
import { refreshFeeds } from '@/lib/refresh';

const DUE_FEEDS_PER_RUN = 300;
const ITEM_RETENTION = '90 days';

export async function refreshDueFeeds(now: Date) {
  // ponytail: capped per run; page through or fan out if the daily cron starts timing out
  const feeds = await prisma.feed.findMany({
    where: { nextFetchAt: { lte: now }, subscriptions: { some: {} } },
    orderBy: { nextFetchAt: 'asc' },
    take: DUE_FEEDS_PER_RUN,
    select: { id: true },
  });
  await refreshFeeds(feeds.map(({ id }) => id));
  return feeds.length;
}

export function purgeOrphanFeeds() {
  return prisma.$executeRaw`
    DELETE FROM "Feed" f
    WHERE NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."feedId" = f.id)
      AND NOT EXISTS (
        SELECT 1 FROM "Item" i JOIN "ItemState" st ON st."itemId" = i.id
        WHERE i."feedId" = f.id AND st."savedAt" IS NOT NULL)`;
}

// ponytail: an item still listed in its feed's XML is re-inserted after purging; tombstone guids if that matters
export function purgeOldItems(now: Date) {
  return prisma.$executeRaw`
    DELETE FROM "Item" i
    WHERE i."publishedAt" < ${now}::timestamp - ${ITEM_RETENTION}::interval
      AND i."createdAt" < ${now}::timestamp - ${ITEM_RETENTION}::interval
      AND NOT EXISTS (
        SELECT 1 FROM "ItemState" st WHERE st."itemId" = i.id AND st."savedAt" IS NOT NULL)`;
}

export async function purgeAiBookkeeping(now: Date) {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3_600_000);
  const [briefings, usage] = await Promise.all([
    prisma.digestBriefing.deleteMany({ where: { createdAt: { lt: weekAgo } } }),
    prisma.aiUsage.deleteMany({ where: { day: { lt: weekAgo } } }),
  ]);
  return briefings.count + usage.count;
}
