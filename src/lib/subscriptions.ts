import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import prisma from '@/lib/db';
import discoverFeedUrls from '@/lib/feeds/discover';
import { fetchFeed } from '@/lib/feeds/fetch';
import { feedHealth } from '@/lib/feeds/health';
import { FeedParseError, parseFeed } from '@/lib/feeds/parse';
import moveItem from '@/lib/manage/order';
import { refreshFeed } from '@/lib/refresh';
import sampleFeeds from '../../data/sample-feeds.json';

export interface FeedPreview {
  url: string;
  title: string;
  description: string | null;
  iconUrl: string | null;
  siteUrl: string | null;
}

type PreviewResult = { ok: true; feed: FeedPreview } | { ok: false; message: string };

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

async function fetchPreview(rawUrl: string, discover: boolean): Promise<PreviewResult> {
  const result = await fetchFeed(rawUrl);
  if (result.kind === 'error') return { ok: false, message: result.error.message };
  if (result.kind === 'not-modified') return { ok: false, message: 'The feed returned no content' };
  try {
    const parsed = parseFeed(result.body, result.finalUrl);
    const siteUrl = parsed.siteUrl ?? null;
    return {
      ok: true,
      feed: {
        url: result.finalUrl,
        title: parsed.title || new URL(result.finalUrl).hostname,
        description: parsed.description,
        iconUrl: parsed.iconUrl ?? `${new URL(siteUrl ?? result.finalUrl).origin}/favicon.ico`,
        siteUrl,
      },
    };
  } catch (error) {
    if (!(error instanceof FeedParseError)) throw error;
    const [candidate] = discover ? discoverFeedUrls(result.body, result.finalUrl) : [];
    if (candidate) return fetchPreview(candidate, false);
    return {
      ok: false,
      message: discover ? error.message : "We couldn't find a working feed on that page",
    };
  }
}

export const previewFeed = (rawUrl: string) => fetchPreview(rawUrl, true);

async function ownedCategoryId(userId: string, categoryId: string | null) {
  if (!categoryId) return null;
  const category = await prisma.category.findFirst({
    where: { id: categoryId, userId },
    select: { id: true },
  });
  return category?.id ?? null;
}

export async function subscribe(
  userId: string,
  rawUrl: string,
  categoryId: string | null
): Promise<PreviewResult> {
  const preview = await previewFeed(rawUrl);
  if (!preview.ok) return preview;
  const { url, title, description, iconUrl, siteUrl } = preview.feed;
  const feed = await prisma.feed.upsert({
    where: { url },
    create: { url, title, description, iconUrl, siteUrl },
    update: {},
  });
  try {
    await prisma.subscription.create({
      data: { userId, feedId: feed.id, categoryId: await ownedCategoryId(userId, categoryId) },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { ok: false, message: 'You already follow this feed' };
  }
  await refreshFeed(feed.id);
  return preview;
}

export async function updateSubscription(
  userId: string,
  subscriptionId: string,
  { title, categoryId }: { title: string | null; categoryId: string | null }
) {
  await prisma.subscription.updateMany({
    where: { id: subscriptionId, userId },
    data: { title, categoryId: await ownedCategoryId(userId, categoryId) },
  });
}

export async function unsubscribe(userId: string, subscriptionId: string) {
  await prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findFirst({
      where: { id: subscriptionId, userId },
      select: { feedId: true },
    });
    if (!subscription) return;
    // ponytail: drops saved items too until Phase 5 adds savedAt; then keep rows where savedAt is set.
    await tx.itemState.deleteMany({ where: { userId, item: { feedId: subscription.feedId } } });
    await tx.subscription.delete({ where: { id: subscriptionId } });
  });
}

export async function retryFeed(userId: string, subscriptionId: string) {
  const subscription = await prisma.subscription.findFirst({
    where: { id: subscriptionId, userId },
    select: { feedId: true, feed: { select: { lastFetchedAt: true } } },
  });
  if (!subscription) return { retried: false };
  await refreshFeed(subscription.feedId, { force: true });
  const { lastFetchedAt } = await prisma.feed.findUniqueOrThrow({
    where: { id: subscription.feedId },
    select: { lastFetchedAt: true },
  });
  return { retried: lastFetchedAt?.getTime() !== subscription.feed.lastFetchedAt?.getTime() };
}

export async function listManagedFeeds(userId: string) {
  const now = new Date();
  const [categories, subscriptions] = await Promise.all([
    prisma.category.findMany({
      where: { userId },
      orderBy: { position: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.subscription.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        categoryId: true,
        feed: {
          select: {
            title: true,
            url: true,
            siteUrl: true,
            description: true,
            iconUrl: true,
            lastSuccessAt: true,
            latestItemAt: true,
            failCount: true,
            errorPermanent: true,
            lastError: true,
          },
        },
      },
    }),
  ]);
  const feeds = subscriptions
    .map(({ id, title, categoryId, feed }) => ({
      id,
      categoryId,
      customTitle: title,
      title: title || feed.title,
      feedTitle: feed.title,
      url: feed.url,
      siteUrl: feed.siteUrl,
      description: feed.description,
      iconUrl: feed.iconUrl,
      lastSuccessAt: feed.lastSuccessAt,
      lastError: feed.lastError,
      health: feedHealth(feed, now),
      healthInput: feed,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
  return {
    categories: categories.map((category) => ({
      ...category,
      feeds: feeds.filter(({ categoryId }) => categoryId === category.id),
    })),
    uncategorized: feeds.filter(({ categoryId }) => !categoryId),
    feeds,
  };
}

export type ManagedFeeds = Awaited<ReturnType<typeof listManagedFeeds>>;
export type ManagedFeed = ManagedFeeds['feeds'][number];

async function nextCategoryPosition(userId: string) {
  const last = await prisma.category.findFirst({
    where: { userId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return (last?.position ?? -1) + 1;
}

const DUPLICATE_CATEGORY = 'You already have a category with that name';

export async function createCategory(userId: string, name: string) {
  const position = await nextCategoryPosition(userId);
  try {
    await prisma.category.create({ data: { userId, name, position } });
    return null;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return DUPLICATE_CATEGORY;
  }
}

export async function renameCategory(userId: string, categoryId: string, name: string) {
  try {
    await prisma.category.updateMany({ where: { id: categoryId, userId }, data: { name } });
    return null;
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return DUPLICATE_CATEGORY;
  }
}

export async function deleteCategory(userId: string, categoryId: string) {
  await prisma.category.deleteMany({ where: { id: categoryId, userId } });
}

export async function moveCategory(userId: string, categoryId: string, direction: 'up' | 'down') {
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { position: 'asc' },
    select: { id: true },
  });
  const ids = moveItem(
    categories.map(({ id }) => id),
    categoryId,
    direction
  );
  await prisma.$transaction(
    ids.map((id, position) =>
      prisma.category.updateMany({ where: { id, userId }, data: { position } })
    )
  );
}

export const starterPacks = sampleFeeds.categories.map(({ name, feeds }) => ({
  name,
  feedTitles: feeds.map(({ title }) => title),
}));

export async function subscribeStarterPack(userId: string, name: string, position?: number) {
  const pack = sampleFeeds.categories.find((category) => category.name === name);
  if (!pack) return [];
  await prisma.feed.createMany({
    data: pack.feeds.map(({ feedUrl, title, siteUrl, description }) => ({
      url: feedUrl,
      title,
      siteUrl,
      description,
    })),
    skipDuplicates: true,
  });
  const [feeds, next] = await Promise.all([
    prisma.feed.findMany({
      where: { url: { in: pack.feeds.map(({ feedUrl }) => feedUrl) } },
      select: { id: true },
    }),
    nextCategoryPosition(userId),
  ]);
  const category = await prisma.category.upsert({
    where: { userId_name: { userId, name } },
    create: { userId, name, position: position ?? next },
    update: {},
  });
  await prisma.subscription.createMany({
    data: feeds.map(({ id }) => ({ userId, feedId: id, categoryId: category.id })),
    skipDuplicates: true,
  });
  return feeds.map(({ id }) => id);
}
