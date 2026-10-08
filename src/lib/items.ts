import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/db';
import { feedHealth } from '@/lib/feeds/health';
import rollUpCounts from '@/lib/reading/counts';
import { type Cursor, encodeCursor } from '@/lib/reading/cursor';
import type { ListFilter } from '@/lib/reading/filters';

const PAGE_SIZE = 50;

export interface ListedItem {
  id: string;
  title: string;
  url: string | null;
  excerpt: string;
  publishedAt: Date;
  imageUrl: string | null;
  hasContent: boolean;
  feedId: string;
  feedTitle: string;
  iconUrl: string | null;
  unread: boolean;
}

export interface ReaderItem extends ListedItem {
  author: string | null;
  contentHtml: string | null;
  siteUrl: string | null;
}

const from = (userId: string) => Prisma.sql`
  FROM "Item" i
  JOIN "Subscription" s ON s."feedId" = i."feedId" AND s."userId" = ${userId}
  JOIN "Feed" f ON f.id = i."feedId"
  LEFT JOIN "ItemState" st ON st."itemId" = i.id AND st."userId" = ${userId}`;

const isUnread = Prisma.sql`(st."readAt" IS NULL AND (st."userId" IS NOT NULL OR i."publishedAt" >= s."createdAt" - interval '14 days'))`;

function scopeSql(filter: ListFilter) {
  if (filter.kind === 'feed') return Prisma.sql`AND i."feedId" = ${filter.id}`;
  if (filter.kind === 'category') {
    return filter.id
      ? Prisma.sql`AND s."categoryId" = ${filter.id}`
      : Prisma.sql`AND s."categoryId" IS NULL`;
  }
  return Prisma.empty;
}

const filterSql = (filter: ListFilter) =>
  Prisma.sql`${scopeSql(filter)} ${filter.unreadOnly ? Prisma.sql`AND ${isUnread}` : Prisma.empty}`;

const listColumns = Prisma.sql`
  i.id, i.title, i.url, i.excerpt, i."publishedAt", i."imageUrl",
  (i."contentHtml" IS NOT NULL) AS "hasContent", i."feedId",
  COALESCE(s.title, f.title) AS "feedTitle", f."iconUrl", ${isUnread} AS unread`;

const position = ({ publishedAt, id }: Cursor) =>
  Prisma.sql`(${publishedAt}::timestamp, ${id}::text)`;

export async function listItems(userId: string, filter: ListFilter, cursor: Cursor | null) {
  const rows = await prisma.$queryRaw<ListedItem[]>`
    SELECT ${listColumns} ${from(userId)}
    WHERE TRUE ${filterSql(filter)}
    ${cursor ? Prisma.sql`AND (i."publishedAt", i.id) < ${position(cursor)}` : Prisma.empty}
    ORDER BY i."publishedAt" DESC, i.id DESC
    LIMIT ${PAGE_SIZE + 1}`;
  const items = rows.slice(0, PAGE_SIZE);
  const last = items.at(-1);
  return {
    items,
    nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(last) : null,
    fetchedAt: Date.now(),
  };
}

export async function getItemForUser(userId: string, itemId: string): Promise<ReaderItem | null> {
  const [item] = await prisma.$queryRaw<ReaderItem[]>`
    SELECT ${listColumns}, i.author, i."contentHtml", f."siteUrl" ${from(userId)}
    WHERE i.id = ${itemId}`;
  return item ?? null;
}

export async function getNeighbors(userId: string, filter: ListFilter, current: Cursor) {
  const [[newer], [older]] = await Promise.all([
    prisma.$queryRaw<{ id: string }[]>`
      SELECT i.id ${from(userId)}
      WHERE (i."publishedAt", i.id) > ${position(current)} ${filterSql(filter)}
      ORDER BY i."publishedAt" ASC, i.id ASC LIMIT 1`,
    prisma.$queryRaw<{ id: string }[]>`
      SELECT i.id ${from(userId)}
      WHERE (i."publishedAt", i.id) < ${position(current)} ${filterSql(filter)}
      ORDER BY i."publishedAt" DESC, i.id DESC LIMIT 1`,
  ]);
  return { newerId: newer?.id ?? null, olderId: older?.id ?? null };
}

export async function filterLabel(userId: string, filter: ListFilter) {
  if (filter.kind === 'all') return 'All items';
  if (filter.kind === 'category') {
    if (!filter.id) return 'Uncategorized';
    const category = await prisma.category.findFirst({
      where: { id: filter.id, userId },
      select: { name: true },
    });
    return category?.name ?? 'Unknown category';
  }
  const subscription = await prisma.subscription.findFirst({
    where: { userId, feedId: filter.id },
    select: { title: true, feed: { select: { title: true } } },
  });
  return subscription ? subscription.title || subscription.feed.title : 'Unknown feed';
}

export function unreadCounts(userId: string) {
  return prisma.$queryRaw<{ feedId: string; count: number }[]>`
    SELECT i."feedId", count(*)::int AS count ${from(userId)}
    WHERE ${isUnread}
    GROUP BY i."feedId"`;
}

export async function getNavigation(userId: string) {
  const now = new Date();
  const [categories, subscriptions, feedCounts] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.subscription.findMany({
      where: { userId },
      select: {
        categoryId: true,
        title: true,
        feed: {
          select: {
            id: true,
            title: true,
            iconUrl: true,
            lastSuccessAt: true,
            latestItemAt: true,
            failCount: true,
            errorPermanent: true,
          },
        },
      },
    }),
    unreadCounts(userId),
  ]);

  const feeds = subscriptions
    .map(({ categoryId, title, feed }) => ({
      id: feed.id,
      title: title || feed.title,
      iconUrl: feed.iconUrl,
      categoryId,
      health: feedHealth(feed, now),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
  const counts = rollUpCounts(
    feedCounts,
    feeds.map(({ id, categoryId }) => ({ feedId: id, categoryId }))
  );

  return {
    counts,
    categories: categories.map((category) => ({
      ...category,
      feeds: feeds.filter(({ categoryId }) => categoryId === category.id),
    })),
    uncategorized: feeds.filter(({ categoryId }) => !categoryId),
    needAttention: feeds.filter(({ health }) => health === 'error' || health === 'dead').length,
  };
}

export type Navigation = Awaited<ReturnType<typeof getNavigation>>;

export function setRead(userId: string, itemId: string, read: boolean) {
  return prisma.$executeRaw`
    INSERT INTO "ItemState" ("userId", "itemId", "readAt")
    SELECT ${userId}, i.id, ${read ? new Date() : null}::timestamp
    FROM "Item" i
    JOIN "Subscription" s ON s."feedId" = i."feedId" AND s."userId" = ${userId}
    WHERE i.id = ${itemId}
    ON CONFLICT ("userId", "itemId") DO UPDATE SET "readAt" = EXCLUDED."readAt"`;
}

export async function markAllRead(userId: string, filter: ListFilter) {
  const markedAt = new Date();
  const count = await prisma.$executeRaw`
    INSERT INTO "ItemState" ("userId", "itemId", "readAt")
    SELECT ${userId}, i.id, ${markedAt}::timestamp ${from(userId)}
    WHERE ${isUnread} ${scopeSql(filter)}
    ON CONFLICT ("userId", "itemId") DO UPDATE SET "readAt" = EXCLUDED."readAt"`;
  return { count, markedAt };
}

export function undoMarkAllRead(userId: string, markedAt: Date) {
  return prisma.$executeRaw`
    UPDATE "ItemState" SET "readAt" = NULL
    WHERE "userId" = ${userId} AND "readAt" = ${markedAt}::timestamp`;
}

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
