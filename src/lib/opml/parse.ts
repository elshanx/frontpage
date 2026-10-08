import { type Element, isTag } from 'domhandler';
import { findOne } from 'domutils';
import { parseDocument } from 'htmlparser2';

export interface OpmlEntry {
  url: string;
  title: string | null;
  category: string | null;
}

export class OpmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpmlError';
  }
}

const label = ({ attribs }: Element) => (attribs.title ?? attribs.text ?? '').trim() || null;

function collect(outline: Element, path: string[]): OpmlEntry[] {
  const url = outline.attribs.xmlurl?.trim();
  if (url) return [{ url, title: label(outline), category: path.join(' / ') || null }];
  const name = label(outline);
  const children = outline.children.filter(isTag).filter((child) => child.name === 'outline');
  return children.flatMap((child) => collect(child, name ? [...path, name] : path));
}

export default function parseOpml(xml: string): OpmlEntry[] {
  const document = parseDocument(xml, { recognizeSelfClosing: true });
  const opml = findOne((element) => element.name === 'opml', document.children);
  const body = opml && findOne((element) => element.name === 'body', opml.children);
  if (!body) throw new OpmlError("This file isn't an OPML subscription list");
  return body.children
    .filter(isTag)
    .filter((child) => child.name === 'outline')
    .flatMap((child) => collect(child, []));
}
