export type ListFilter =
  | { kind: 'all'; unreadOnly: boolean }
  | { kind: 'category'; id: string | null; unreadOnly: boolean }
  | { kind: 'feed'; id: string; unreadOnly: boolean };

export type SearchParams = Record<string, string | string[] | undefined>;

export const ID_PATTERN = /^[\w-]{1,64}$/;
const UNCATEGORIZED = 'uncategorized';

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseListFilter(params: SearchParams): ListFilter {
  const unreadOnly = first(params.show) === 'unread';
  const feed = first(params.feed);
  const category = first(params.category);
  if (feed !== undefined) {
    return ID_PATTERN.test(feed)
      ? { kind: 'feed', id: feed, unreadOnly }
      : { kind: 'all', unreadOnly: false };
  }
  if (category !== undefined) {
    if (category === UNCATEGORIZED) return { kind: 'category', id: null, unreadOnly };
    return ID_PATTERN.test(category)
      ? { kind: 'category', id: category, unreadOnly }
      : { kind: 'all', unreadOnly: false };
  }
  return { kind: 'all', unreadOnly };
}

export function filterToSearch(filter: ListFilter): string {
  const params = new URLSearchParams();
  if (filter.kind === 'feed') params.set('feed', filter.id);
  if (filter.kind === 'category') params.set('category', filter.id ?? UNCATEGORIZED);
  if (filter.unreadOnly) params.set('show', 'unread');
  const search = params.toString();
  return search ? `?${search}` : '';
}
