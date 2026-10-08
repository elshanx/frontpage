import 'server-only';
import type { Feed } from '@/generated/prisma/client';
import prisma from '@/lib/db';
import { type FeedError, fetchFeed } from '@/lib/feeds/fetch';
import { nextFetchAt } from '@/lib/feeds/health';
import { latestPublished, toItemRows } from '@/lib/feeds/ingest';
import { FeedParseError, type ParsedFeed, parseFeed } from '@/lib/feeds/parse';

const POOL_SIZE = 6;
const CLAIM_MS = 2 * 60_000;
const MIN_MANUAL_INTERVAL_MS = 60_000;

async function claim(feedId: string, force: boolean, now: Date) {
  const where = force
    ? {
        id: feedId,
        OR: [
          { lastFetchedAt: null },
          { lastFetchedAt: { lte: new Date(now.getTime() - MIN_MANUAL_INTERVAL_MS) } },
        ],
      }
    : { id: feedId, nextFetchAt: { lte: now } };
  const { count } = await prisma.feed.updateMany({
    where,
    data: { lastFetchedAt: now, nextFetchAt: new Date(now.getTime() + CLAIM_MS) },
  });
  return count === 1;
}

async function recordFailure(feed: Feed, error: FeedError, now: Date) {
  const failCount = feed.failCount + 1;
  await prisma.feed.update({
    where: { id: feed.id },
    data: {
      failCount,
      lastError: error.message,
      lastErrorStatus: error.status,
      errorPermanent: error.permanent,
      nextFetchAt: nextFetchAt(failCount, now),
    },
  });
}

async function movedUrl(feed: Feed, finalUrl: string, movedPermanently: boolean) {
  if (!movedPermanently || finalUrl === feed.url) return {};
  const taken = await prisma.feed.findUnique({ where: { url: finalUrl }, select: { id: true } });
  return taken ? {} : { url: finalUrl };
}

const successFields = (now: Date) => ({
  lastSuccessAt: now,
  failCount: 0,
  lastError: null,
  lastErrorStatus: null,
  errorPermanent: false,
  nextFetchAt: nextFetchAt(0, now),
});

export async function refreshFeed(feedId: string, { force = false } = {}): Promise<void> {
  const now = new Date();
  if (!(await claim(feedId, force, now))) return;
  const feed = await prisma.feed.findUniqueOrThrow({ where: { id: feedId } });
  const result = await fetchFeed(feed.url, { etag: feed.etag, lastModified: feed.lastModified });

  if (result.kind === 'error') {
    await recordFailure(feed, result.error, now);
    return;
  }
  if (result.kind === 'not-modified') {
    await prisma.feed.update({
      where: { id: feed.id },
      data: {
        ...successFields(now),
        ...(await movedUrl(feed, result.finalUrl, result.movedPermanently)),
      },
    });
    return;
  }

  let parsed: ParsedFeed;
  try {
    parsed = parseFeed(result.body, result.finalUrl);
  } catch (error) {
    if (!(error instanceof FeedParseError)) throw error;
    await recordFailure(
      feed,
      { kind: 'not-a-feed', message: error.message, status: null, permanent: true },
      now
    );
    return;
  }

  const rows = toItemRows(feed.id, parsed.items, now);
  const newest = latestPublished(rows);
  const siteUrl = parsed.siteUrl ?? feed.siteUrl;
  await prisma.$transaction([
    prisma.item.createMany({ data: rows, skipDuplicates: true }),
    prisma.feed.update({
      where: { id: feed.id },
      data: {
        ...successFields(now),
        ...(await movedUrl(feed, result.finalUrl, result.movedPermanently)),
        title: feed.title || parsed.title || new URL(feed.url).hostname,
        siteUrl,
        description: feed.description ?? parsed.description,
        iconUrl:
          parsed.iconUrl ?? feed.iconUrl ?? `${new URL(siteUrl ?? feed.url).origin}/favicon.ico`,
        etag: result.etag,
        lastModified: result.lastModified,
        latestItemAt:
          newest && (!feed.latestItemAt || newest > feed.latestItemAt) ? newest : feed.latestItemAt,
      },
    }),
  ]);
}

export async function refreshFeeds(feedIds: string[], options: { force?: boolean } = {}) {
  const queue = [...feedIds];
  const worker = async (): Promise<void> => {
    const feedId = queue.shift();
    if (!feedId) return;
    await refreshFeed(feedId, options).catch((error: unknown) => {
      console.error(`Refreshing feed ${feedId} failed`, error);
    });
    await worker();
  };
  await Promise.all(Array.from({ length: Math.min(POOL_SIZE, queue.length) }, worker));
}
