import type { OpmlEntry } from './parse.ts';

export type ImportStatus = 'new' | 'duplicate' | 'subscribed';

export interface ImportRow extends OpmlEntry {
  status: ImportStatus;
}

export function urlKey(url: string): string {
  try {
    return new URL(url).href;
  } catch {
    return url;
  }
}

export default function planImport(entries: OpmlEntry[], subscribedUrls: string[]): ImportRow[] {
  const subscribed = new Set(subscribedUrls.map(urlKey));
  const seen = new Set<string>();
  return entries.map((entry) => {
    const key = urlKey(entry.url);
    let status: ImportStatus = 'new';
    if (seen.has(key)) status = 'duplicate';
    else if (subscribed.has(key)) status = 'subscribed';
    seen.add(key);
    return { ...entry, status };
  });
}
