import { createHash } from 'node:crypto';
import type { ParsedItem } from './parse.ts';

export const MAX_ITEMS_PER_FETCH = 200;

export interface ItemRow {
  feedId: string;
  guid: string;
  url: string | null;
  title: string;
  author: string | null;
  excerpt: string;
  contentHtml: string | null;
  imageUrl: string | null;
  publishedAt: Date;
}

const fallbackGuid = ({ title, publishedAt }: ParsedItem) =>
  createHash('sha1')
    .update(`${title}\n${publishedAt?.toISOString() ?? ''}`)
    .digest('hex');

export function toItemRows(feedId: string, items: ParsedItem[], fetchedAt: Date): ItemRow[] {
  return items.slice(0, MAX_ITEMS_PER_FETCH).map((item) => ({
    feedId,
    guid: item.guid ?? item.url ?? fallbackGuid(item),
    url: item.url,
    title: item.title,
    author: item.author,
    excerpt: item.excerpt,
    contentHtml: item.contentHtml,
    imageUrl: item.imageUrl,
    publishedAt: item.publishedAt && item.publishedAt < fetchedAt ? item.publishedAt : fetchedAt,
  }));
}

export function latestPublished(rows: ItemRow[]): Date | null {
  return rows.reduce<Date | null>(
    (latest, { publishedAt }) => (!latest || publishedAt > latest ? publishedAt : latest),
    null
  );
}
