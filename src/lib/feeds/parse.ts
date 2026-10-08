import { type Element, isTag } from 'domhandler';
import { getElementsByTagName, getInnerHTML, textContent } from 'domutils';
import { escapeUTF8 } from 'entities';
import { parseDocument } from 'htmlparser2';
import parseDate from './dates.ts';
import { cleanText, firstImage, httpUrl, sanitizeContent, toExcerpt, toPlainText } from './html.ts';

const FULL_CONTENT_MIN_CHARS = 500;
const TITLE_FROM_EXCERPT_CHARS = 80;

export type FeedFormat = 'rss2' | 'atom' | 'rdf';

export interface ParsedItem {
  guid: string | null;
  url: string | null;
  title: string;
  author: string | null;
  publishedAt: Date | null;
  excerpt: string;
  contentHtml: string | null;
  imageUrl: string | null;
}

export interface ParsedFeed {
  format: FeedFormat;
  title: string | null;
  siteUrl: string | null;
  description: string | null;
  iconUrl: string | null;
  items: ParsedItem[];
}

export class FeedParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeedParseError';
  }
}

interface ItemFields {
  guid: string | null;
  url: string | null;
  title: string;
  author: string | null;
  date: string | null;
  contentHtml: string | null;
  summaryHtml: string | null;
  hasExplicitContent: boolean;
  node: Element;
}

const elementChildren = (parent: Element, name: string) =>
  parent.children.filter((node): node is Element => isTag(node) && node.name === name);

const firstChild = (parent: Element | undefined, name: string) =>
  parent ? elementChildren(parent, name)[0] : undefined;

const textOf = (parent: Element | undefined, ...names: string[]) =>
  names
    .map((name) => {
      const node = firstChild(parent, name);
      return node ? textContent(node).trim() : '';
    })
    .find(Boolean) ?? null;

const isPresent = <T>(value: T | null): value is T => value !== null;

function mediaImage(node: Element): string | null {
  const thumbnail = getElementsByTagName('media:thumbnail', node, true, 1)[0]?.attribs.url;
  const media = getElementsByTagName('media:content', node).find(
    ({ attribs }) => attribs.medium === 'image' || attribs.type?.startsWith('image/')
  )?.attribs.url;
  const enclosure = elementChildren(node, 'enclosure').find(({ attribs }) =>
    attribs.type?.startsWith('image/')
  )?.attribs.url;
  return thumbnail ?? media ?? enclosure ?? null;
}

function buildItem(fields: ItemFields): ParsedItem | null {
  const base = fields.url ?? undefined;
  const content = fields.contentHtml ? sanitizeContent(fields.contentHtml, base) : '';
  const excerpt = toExcerpt(fields.summaryHtml ?? content);
  const title = fields.title || excerpt.slice(0, TITLE_FROM_EXCERPT_CHARS) || fields.url;
  if (!title) return null;

  const isFullContent =
    fields.hasExplicitContent || toPlainText(content).length >= FULL_CONTENT_MIN_CHARS;
  return {
    guid: fields.guid,
    url: fields.url,
    title,
    author: fields.author,
    publishedAt: parseDate(fields.date),
    excerpt,
    contentHtml: content && isFullContent ? content : null,
    imageUrl: httpUrl(mediaImage(fields.node), base) ?? firstImage(content),
  };
}

function rssItem(node: Element, base: string | undefined): ParsedItem | null {
  const guidNode = firstChild(node, 'guid');
  const guid = (guidNode && textContent(guidNode).trim()) || node.attribs['rdf:about'] || null;
  const guidLink =
    guid && guidNode?.attribs.ispermalink !== 'false' && /^https?:\/\//i.test(guid) ? guid : null;
  const encoded = textOf(node, 'content:encoded');
  const description = textOf(node, 'description');
  return buildItem({
    guid,
    url: httpUrl(textOf(node, 'link') ?? guidLink, base),
    title: cleanText(textOf(node, 'title') ?? ''),
    author: textOf(node, 'dc:creator', 'author'),
    date: textOf(node, 'pubdate', 'dc:date'),
    contentHtml: encoded ?? description,
    summaryHtml: encoded ? description : null,
    hasExplicitContent: Boolean(encoded),
    node,
  });
}

function parseRss(root: Element, format: 'rss2' | 'rdf', feedUrl?: string): ParsedFeed {
  const channel = firstChild(root, 'channel');
  const siteUrl = httpUrl(textOf(channel, 'link'), feedUrl);
  const base = siteUrl ?? feedUrl;
  const image = firstChild(root, 'image') ?? firstChild(channel, 'image');
  return {
    format,
    title: cleanText(textOf(channel, 'title') ?? '') || null,
    siteUrl,
    description: toPlainText(textOf(channel, 'description') ?? '') || null,
    iconUrl: httpUrl(textOf(image, 'url'), base),
    items: elementChildren(format === 'rdf' ? root : (channel ?? root), 'item')
      .map((node) => rssItem(node, base))
      .filter(isPresent),
  };
}

function atomHtml(node: Element | undefined): string | null {
  if (!node || node.attribs.src) return null;
  if (node.attribs.type === 'xhtml') return getInnerHTML(node).trim() || null;
  const value = textContent(node).trim();
  if (!value) return null;
  return node.attribs.type === 'html' || node.attribs.type === 'text/html'
    ? value
    : escapeUTF8(value);
}

const atomText = (node: Element | undefined) => {
  const html = atomHtml(node);
  return html ? toPlainText(html) || null : null;
};

const atomLink = (node: Element) =>
  elementChildren(node, 'link').find(({ attribs }) => !attribs.rel || attribs.rel === 'alternate')
    ?.attribs.href ?? null;

function atomEntry(node: Element, base: string | undefined): ParsedItem | null {
  const content = atomHtml(firstChild(node, 'content'));
  const summary = atomHtml(firstChild(node, 'summary'));
  return buildItem({
    guid: textOf(node, 'id'),
    url: httpUrl(atomLink(node), base),
    title: atomText(firstChild(node, 'title')) ?? '',
    author: textOf(firstChild(node, 'author'), 'name'),
    date: textOf(node, 'published', 'updated'),
    contentHtml: content ?? summary,
    summaryHtml: content ? summary : null,
    hasExplicitContent: Boolean(content),
    node,
  });
}

function parseAtom(root: Element, feedUrl?: string): ParsedFeed {
  const siteUrl = httpUrl(atomLink(root), feedUrl);
  const base = siteUrl ?? feedUrl;
  return {
    format: 'atom',
    title: atomText(firstChild(root, 'title')),
    siteUrl,
    description: atomText(firstChild(root, 'subtitle')),
    iconUrl: httpUrl(textOf(root, 'icon', 'logo'), base),
    items: elementChildren(root, 'entry')
      .map((node) => atomEntry(node, base))
      .filter(isPresent),
  };
}

function parseRoot(root: Element | undefined, feedUrl?: string): ParsedFeed {
  if (root?.name === 'rss') return parseRss(root, 'rss2', feedUrl);
  if (root?.name === 'rdf:rdf') return parseRss(root, 'rdf', feedUrl);
  if (root?.name === 'feed') return parseAtom(root, feedUrl);
  if (root?.name === 'html') {
    throw new FeedParseError('This address returned a web page, not a feed');
  }
  throw new FeedParseError("This doesn't look like an RSS or Atom feed");
}

const ONLY_WHITESPACE_AND_COMMENTS = /^(?:\s|<!--(?:(?!-->)[\s\S])*-->)*$/;

const isTruncated = (xml: string, rootName: string) => {
  const closingTag = `</${rootName}>`;
  const end = xml.toLowerCase().lastIndexOf(closingTag);
  return end === -1 || !ONLY_WHITESPACE_AND_COMMENTS.test(xml.slice(end + closingTag.length));
};

export function parseFeed(xml: string, feedUrl?: string): ParsedFeed {
  const text = xml.replaceAll('\u0000', '');
  const dom = parseDocument(text, {
    xmlMode: true,
    lowerCaseTags: true,
    lowerCaseAttributeNames: true,
  });
  const root = dom.children.find(isTag);
  const feed = parseRoot(root, feedUrl);
  if (root && isTruncated(text, root.name)) feed.items = feed.items.slice(0, -1);
  return feed;
}
