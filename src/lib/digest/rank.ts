export interface DigestCandidate {
  id: string;
  feedId: string;
  categoryId: string | null;
  publishedAt: Date;
}

export type DigestWindow = 'since' | 'day' | 'week';

export type DigestResult<T> =
  | { kind: 'quiet'; items: T[] }
  | { kind: 'ranked'; groups: { categoryId: string | null; items: T[]; more: number }[] };

const HOUR = 3_600_000;
const HALF_LIFE_HOURS = 12;
const QUIET_BELOW = 8;
const PER_FEED = 2;
const PER_GROUP = 5;

export function digestWindowStart(window: DigestWindow, seenAt: Date | null, now: Date): Date {
  if (window === 'week') return new Date(now.getTime() - 7 * 24 * HOUR);
  if (window === 'since' && seenAt) return seenAt;
  return new Date(now.getTime() - 24 * HOUR);
}

export default function rankDigest<T extends DigestCandidate>(
  items: T[],
  weeklyCounts: Record<string, number>,
  now: Date
): DigestResult<T> {
  const newest = (a: T, b: T) => b.publishedAt.getTime() - a.publishedAt.getTime();
  if (items.length < QUIET_BELOW) return { kind: 'quiet', items: [...items].sort(newest) };

  const score = ({ feedId, publishedAt }: T) => {
    const ageHours = Math.max(0, now.getTime() - publishedAt.getTime()) / HOUR;
    return 0.5 ** (ageHours / HALF_LIFE_HOURS) / Math.log2(2 + (weeklyCounts[feedId] ?? 0));
  };
  const ranked = [...items].sort((a, b) => score(b) - score(a) || newest(a, b));

  interface Group { items: T[]; total: number; perFeed: Map<string, number> }
  const groups = new Map<string | null, Group>();
  ranked.forEach((candidate) => {
    const group: Group = groups.get(candidate.categoryId) ?? {
      items: [],
      total: 0,
      perFeed: new Map(),
    };
    groups.set(candidate.categoryId, group);
    group.total += 1;
    const fromFeed = group.perFeed.get(candidate.feedId) ?? 0;
    if (group.items.length < PER_GROUP && fromFeed < PER_FEED) {
      group.items.push(candidate);
      group.perFeed.set(candidate.feedId, fromFeed + 1);
    }
  });

  return {
    kind: 'ranked',
    groups: [...groups].map(([categoryId, group]) => ({
      categoryId,
      items: group.items,
      more: group.total - group.items.length,
    })),
  };
}
