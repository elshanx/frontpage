import { findAll } from 'domutils';
import { parseDocument } from 'htmlparser2';
import { httpUrl } from './html.ts';

const FEED_TYPE = /^application\/(rss|atom)\+xml$/i;

export default function discoverFeedUrls(html: string, baseUrl: string): string[] {
  const links = findAll(
    ({ name, attribs }) =>
      name === 'link' &&
      (attribs.rel ?? '').toLowerCase().split(/\s+/).includes('alternate') &&
      FEED_TYPE.test((attribs.type ?? '').trim()),
    parseDocument(html).children
  );
  const urls = links.flatMap(({ attribs }) => httpUrl(attribs.href, baseUrl) ?? []);
  return [...new Set(urls)];
}
