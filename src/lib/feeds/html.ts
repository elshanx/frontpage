import { findAll, getOuterHTML, removeElement } from 'domutils';
import { decodeHTML } from 'entities';
import { parseDocument } from 'htmlparser2';
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'br',
  'hr',
  'ul',
  'ol',
  'li',
  'dl',
  'dt',
  'dd',
  'blockquote',
  'pre',
  'code',
  'kbd',
  'em',
  'strong',
  'b',
  'i',
  'u',
  's',
  'del',
  'ins',
  'mark',
  'sub',
  'sup',
  'a',
  'img',
  'figure',
  'figcaption',
  'picture',
  'source',
  'table',
  'thead',
  'tbody',
  'tfoot',
  'tr',
  'th',
  'td',
  'caption',
];
const DROPPED_WITH_CONTENT = [
  'script',
  'style',
  'textarea',
  'option',
  'noscript',
  'nav',
  'aside',
  'form',
  'button',
  'iframe',
  'svg',
  'template',
];
const NOISE =
  /(^|[\s_-])(ad|ads|advert|advertisement|sponsor|sponsored|promo|share|sharing|social|related)([\s_-]|$)/i;
const TRACKER_SRC = /\/_\/stat|pixel|beacon|tracking|feedburner\.com\/~r|\/~ff\//i;
const BLOCK_END = /<\/(p|div|li|h[1-6]|blockquote|pre|tr|figcaption)>|<br\s*\/?>/gi;

export function httpUrl(value: string | null | undefined, base?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim(), base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function resolveAttribute(attribs: sanitizeHtml.Attributes, key: string, base?: string) {
  const { [key]: value, ...rest } = attribs;
  if (!value) return rest;
  try {
    return { ...rest, [key]: new URL(value, base).href };
  } catch {
    return rest;
  }
}

function isTrackingPixel(attribs: sanitizeHtml.Attributes) {
  return (
    attribs.width === '1' ||
    attribs.height === '1' ||
    attribs.width === '0' ||
    TRACKER_SRC.test(attribs.src ?? '')
  );
}

function stripNoise(html: string): string {
  const dom = parseDocument(html);
  findAll(
    ({ attribs }) => NOISE.test(attribs.class ?? '') || NOISE.test(attribs.id ?? ''),
    dom.children
  ).forEach(removeElement);
  return getOuterHTML(dom.children);
}

export function sanitizeContent(html: string, baseUrl?: string): string {
  return sanitizeHtml(stripNoise(html), {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title', 'rel', 'target'],
      img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
      source: ['srcset', 'type', 'media'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
    },
    allowedClasses: { code: ['language-*'], pre: ['language-*'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    nonTextTags: DROPPED_WITH_CONTENT,
    transformTags: {
      h1: 'h2',
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...resolveAttribute(attribs, 'href', baseUrl),
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...resolveAttribute(attribs, 'src', baseUrl),
          loading: 'lazy',
          decoding: 'async',
        },
      }),
    },
    exclusiveFilter: ({ tag, attribs }) =>
      tag === 'img' && (!attribs.src || isTrackingPixel(attribs)),
  });
}

export function cleanText(text: string): string {
  return decodeHTML(text).replace(/\s+/g, ' ').trim();
}

export function toPlainText(html: string): string {
  const text = sanitizeHtml(html.replace(BLOCK_END, '$& '), {
    allowedTags: [],
    allowedAttributes: {},
    nonTextTags: DROPPED_WITH_CONTENT,
  });
  return cleanText(text);
}

export function toExcerpt(html: string, max = 280): string {
  const text = toPlainText(html);
  if (text.length <= max) return text;
  const cut = text.slice(0, max + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}…`;
}

export function firstImage(html: string): string | null {
  const src = html.match(/<img[^>]*\ssrc="([^"]+)"/i)?.[1];
  return src ? httpUrl(decodeHTML(src)) : null;
}
