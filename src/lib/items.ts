import 'server-only';
import { cache } from 'react';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/db';
import { feedHealth } from '@/lib/feeds/health';
import rollUpCounts from '@/lib/reading/counts';
import { type Cursor, encodeCursor } from '@/lib/reading/cursor';
import type { ListFilter } from '@/lib/reading/filters';
import { toTsQuery, type SearchParams } from '@/lib/search/query';
import { MARK_END, MARK_START } from '@/lib/search/highlight';

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
  saved: boolean;
}

export interface ReaderItem extends ListedItem {
  author: string | null;
  contentHtml: string | null;
  siteUrl: string | null;
  aiSummary: string | null;
}

const from = (userId: string) => Prisma.sql`
  FROM "Item" i
  JOIN "Subscription" s ON s."feedId" = i."feedId" AND s."userId" = ${userId}
  JOIN "Feed" f ON f.id = i."feedId"
  LEFT JOIN "ItemState" st ON st."itemId" = i.id AND st."userId" = ${userId}`;

const visibleFrom = (userId: string) => Prisma.sql`
  FROM "Item" i
  LEFT JOIN "Subscription" s ON s."feedId" = i."feedId" AND s."userId" = ${userId}
  JOIN "Feed" f ON f.id = i."feedId"
  LEFT JOIN "ItemState" st ON st."itemId" = i.id AND st."userId" = ${userId}`;

const isVisible = Prisma.sql`(s.id IS NOT NULL OR st."savedAt" IS NOT NULL)`;

const isUnread = Prisma.sql`(st."readAt" IS NULL AND (st."userId" IS NOT NULL OR i."publishedAt" >= s."createdAt" - interval '14 days'))`;

function scopeSql(filter: ListFilter) {
  if (filter.kind === 'feed') return Prisma.sql`AND s."feedId" = ${filter.id}`;
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
  COALESCE(s.title, f.title) AS "feedTitle", f."iconUrl", ${isUnread} AS unread,
  (st."savedAt" IS NOT NULL) AS saved`;

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
    SELECT ${listColumns}, i.author, i."contentHtml", f."siteUrl", i."aiSummary" ${visibleFrom(userId)}
    WHERE i.id = ${itemId} AND ${isVisible}`;
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

export function savedCount(userId: string) {
  return prisma.itemState.count({ where: { userId, savedAt: { not: null } } });
}

export const getNavigation = cache(async (userId: string) => {
  const now = new Date();
  const [categories, subscriptions, feedCounts, saved] = await Promise.all([
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
    savedCount(userId),
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
    saved,
    categories: categories.map((category) => ({
      ...category,
      feeds: feeds.filter(({ categoryId }) => categoryId === category.id),
    })),
    uncategorized: feeds.filter(({ categoryId }) => !categoryId),
    needAttention: feeds.filter(({ health }) => health === 'error' || health === 'dead').length,
  };
});

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

export async function markAllRead(userId: string, filter: ListFilter, seenAt: Date) {
  const markedAt = new Date();
  const count = await prisma.$executeRaw`
    INSERT INTO "ItemState" ("userId", "itemId", "readAt")
    SELECT ${userId}, i.id, ${markedAt}::timestamp ${from(userId)}
    WHERE ${isUnread} ${scopeSql(filter)} AND i."createdAt" <= ${seenAt}::timestamp
    ON CONFLICT ("userId", "itemId") DO UPDATE SET "readAt" = EXCLUDED."readAt"`;
  return { count, markedAt };
}

export async function undoMarkAllRead(userId: string, markedAt: Date) {
  const rows = await prisma.$queryRaw<{ itemId: string }[]>`
    UPDATE "ItemState" SET "readAt" = NULL
    WHERE "userId" = ${userId} AND "readAt" = ${markedAt}::timestamp
    RETURNING "itemId"`;
  return rows.map(({ itemId }) => itemId);
}

export function setSaved(userId: string, itemId: string, saved: boolean) {
  const now = new Date();
  return prisma.$executeRaw`
    INSERT INTO "ItemState" ("userId", "itemId", "readAt", "savedAt")
    SELECT ${userId}, i.id,
      CASE WHEN ${isUnread} THEN NULL ELSE COALESCE(st."readAt", ${now}::timestamp) END,
      ${saved ? now : null}::timestamp
    ${visibleFrom(userId)}
    WHERE i.id = ${itemId} AND ${isVisible}
    ON CONFLICT ("userId", "itemId") DO UPDATE SET "savedAt" = EXCLUDED."savedAt"`;
}

export type SavedSort = 'saved' | 'published';

const SAVED_LIMIT = 500;

export async function listSaved(userId: string, sort: SavedSort, q: string) {
  const query = toTsQuery(q);
  // ponytail: no pagination for saved; add a (savedAt, id) cursor if lists grow past 500.
  const items = await prisma.$queryRaw<ListedItem[]>`
    SELECT ${listColumns} ${visibleFrom(userId)}
    WHERE st."savedAt" IS NOT NULL
    ${query ? Prisma.sql`AND i.search @@ to_tsquery('english', ${query})` : Prisma.empty}
    ORDER BY ${sort === 'published' ? Prisma.sql`i."publishedAt"` : Prisma.sql`st."savedAt"`} DESC, i.id DESC
    LIMIT ${SAVED_LIMIT}`;
  return { items, fetchedAt: Date.now() };
}

export interface SearchResult extends ListedItem {
  titleHighlight: string;
  excerptHighlight: string;
}

const SEARCH_LIMIT = 50;
const HEADLINE = `StartSel=${MARK_START}, StopSel=${MARK_END}`;

export function searchItems(userId: string, params: SearchParams) {
  const query = toTsQuery(params.q);
  if (!query) return Promise.resolve([]);
  return prisma.$queryRaw<SearchResult[]>`
    SELECT ${listColumns},
      ts_headline('english', i.title, q, ${`${HEADLINE}, HighlightAll=true`}) AS "titleHighlight",
      ts_headline('english', i.excerpt, q, ${`${HEADLINE}, MaxFragments=2, MaxWords=30, MinWords=10`}) AS "excerptHighlight"
    ${from(userId)}, to_tsquery('english', ${query}) q
    WHERE i.search @@ q
    ${params.feedId ? Prisma.sql`AND i."feedId" = ${params.feedId}` : Prisma.empty}
    ${params.categoryId ? Prisma.sql`AND s."categoryId" = ${params.categoryId}` : Prisma.empty}
    ${params.from ? Prisma.sql`AND i."publishedAt" >= ${params.from}::timestamp` : Prisma.empty}
    ${params.to ? Prisma.sql`AND i."publishedAt" <= ${params.to}::timestamp` : Prisma.empty}
    ORDER BY ts_rank(i.search, q) DESC, i."publishedAt" DESC
    LIMIT ${SEARCH_LIMIT}`;
}

export function scopedFeeds(userId: string, filter: ListFilter) {
  return prisma.$queryRaw<{ id: string; lastSuccessAt: Date | null; nextFetchAt: Date }[]>`
    SELECT f.id, f."lastSuccessAt", f."nextFetchAt"
    FROM "Subscription" s JOIN "Feed" f ON f.id = s."feedId"
    WHERE s."userId" = ${userId} ${scopeSql(filter)}`;
}

export async function lastUpdated(userId: string, filter: ListFilter) {
  const times = (await scopedFeeds(userId, filter)).map(({ lastSuccessAt }) =>
    lastSuccessAt ? lastSuccessAt.getTime() : 0
  );
  return { lastUpdated: Math.max(0, ...times) || null, now: Date.now() };
}

const newSince = (filter: ListFilter, since: Date) =>
  Prisma.sql`WHERE i."createdAt" > ${since}::timestamp ${filterSql(filter)}`;

export async function countNewItems(userId: string, filter: ListFilter, since: Date) {
  const [{ count }] = await prisma.$queryRaw<{ count: number }[]>`
    SELECT count(*)::int AS count ${from(userId)} ${newSince(filter, since)}`;
  return count;
}

export function listNewItems(userId: string, filter: ListFilter, since: Date) {
  return prisma.$queryRaw<ListedItem[]>`
    SELECT ${listColumns} ${from(userId)} ${newSince(filter, since)}
    ORDER BY i."publishedAt" DESC, i.id DESC
    LIMIT ${PAGE_SIZE}`;
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

export interface DigestItem extends ListedItem {
  categoryId: string | null;
}

const DIGEST_LIMIT = 500;

export function listDigestItems(userId: string, since: Date) {
  return prisma.$queryRaw<DigestItem[]>`
    SELECT ${listColumns}, s."categoryId" ${from(userId)}
    WHERE ${isUnread} AND i."publishedAt" >= ${since}::timestamp
    ORDER BY i."publishedAt" DESC
    LIMIT ${DIGEST_LIMIT}`;
}

export async function weeklyCounts(userId: string, now: Date) {
  const rows = await prisma.$queryRaw<{ feedId: string; count: number }[]>`
    SELECT i."feedId", count(*)::int AS count
    FROM "Item" i JOIN "Subscription" s ON s."feedId" = i."feedId" AND s."userId" = ${userId}
    WHERE i."publishedAt" >= ${new Date(now.getTime() - 7 * 24 * 3_600_000)}::timestamp
    GROUP BY i."feedId"`;
  return Object.fromEntries(rows.map(({ feedId, count }) => [feedId, count]));
}

export function markItemsRead(userId: string, itemIds: string[]) {
  return prisma.$executeRaw`
    INSERT INTO "ItemState" ("userId", "itemId", "readAt")
    SELECT ${userId}, i.id, now()
    FROM "Item" i
    JOIN "Subscription" s ON s."feedId" = i."feedId" AND s."userId" = ${userId}
    WHERE i.id = ANY(${itemIds})
    ON CONFLICT ("userId", "itemId") DO UPDATE SET "readAt" = EXCLUDED."readAt"`;
}

export async function saveSummary(itemId: string, summary: string) {
  await prisma.item.update({ where: { id: itemId }, data: { aiSummary: summary } });
}
