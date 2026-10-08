import 'server-only';
import prisma from '@/lib/db';
import rankDigest, { type DigestWindow, digestWindowStart } from '@/lib/digest/rank';
import { listDigestItems, weeklyCounts } from '@/lib/items';
import { getPreferences } from '@/lib/preferences';

export const DIGEST_WINDOWS: DigestWindow[] = ['since', 'day', 'week'];

export const parseDigestWindow = (raw: unknown): DigestWindow =>
  DIGEST_WINDOWS.find((window) => window === raw) ?? 'since';

const HOUR = 3_600_000;

export async function loadDigest(userId: string, window: DigestWindow) {
  const now = new Date();
  const { digestSeenAt, layout } = await getPreferences(userId);
  const start = digestWindowStart(window, digestSeenAt, now);
  const [items, counts, categories] = await Promise.all([
    listDigestItems(userId, start),
    weeklyCounts(userId, now),
    prisma.category.findMany({ where: { userId }, select: { id: true, name: true } }),
  ]);
  const digest = rankDigest(
    items.map((item) => ({ ...item, publishedAt: new Date(item.publishedAt) })),
    counts,
    now
  );
  const shown = digest.kind === 'quiet' ? digest.items : digest.groups.flatMap((g) => g.items);
  const anchor =
    window === 'since' && digestSeenAt ? start : new Date(Math.floor(now.getTime() / HOUR) * HOUR);
  return {
    now,
    layout,
    digest,
    shown,
    categoryNames: new Map(categories.map(({ id, name }) => [id, name])),
    windowKey: `${window}:${anchor.toISOString()}`,
  };
}
