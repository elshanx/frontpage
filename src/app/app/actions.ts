'use server';

import { refresh } from 'next/cache';
import { after } from 'next/server';
import {
  countNewItems,
  listItems,
  listNewItems,
  markAllRead,
  markItemsRead,
  scopedFeeds,
  setRead,
  setSaved,
  undoMarkAllRead,
} from '@/lib/items';
import { setPreferences } from '@/lib/preferences';
import { decodeCursor } from '@/lib/reading/cursor';
import { ID_PATTERN, parseListFilter } from '@/lib/reading/filters';
import { parseLayout } from '@/lib/reading/layout';
import { refreshFeeds } from '@/lib/refresh';
import { requireUser } from '@/lib/session';

const filterFromSearch = (search: string) =>
  parseListFilter(Object.fromEntries(new URLSearchParams(search)));

export async function loadItems(search: string, cursor: string) {
  const user = await requireUser();
  const position = decodeCursor(cursor);
  if (!position) return { items: [], nextCursor: null, fetchedAt: Date.now() };
  return listItems(user.id, filterFromSearch(search), position);
}

export async function setReadAction(itemId: string, read: boolean) {
  const user = await requireUser();
  if (!ID_PATTERN.test(itemId)) return;
  await setRead(user.id, itemId, read);
  refresh();
}

export async function markAllReadAction(search: string, seenAt: number) {
  const user = await requireUser();
  const seen = new Date(seenAt);
  if (typeof search !== 'string' || Number.isNaN(seen.getTime())) return { count: 0, markedAt: '' };
  const { count, markedAt } = await markAllRead(user.id, filterFromSearch(search), seen);
  refresh();
  return { count, markedAt: markedAt.toISOString() };
}

export async function undoMarkAllReadAction(markedAt: string) {
  const user = await requireUser();
  const date = new Date(markedAt);
  if (Number.isNaN(date.getTime())) return [];
  const itemIds = await undoMarkAllRead(user.id, date);
  refresh();
  return itemIds;
}

export async function setSavedAction(itemId: string, saved: boolean) {
  const user = await requireUser();
  if (!ID_PATTERN.test(itemId)) return;
  await setSaved(user.id, itemId, saved);
  refresh();
}

const validDate = (ms: number) => {
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date;
};

export async function refreshAction(search: string) {
  const user = await requireUser();
  const filter = filterFromSearch(search);
  const feeds = await scopedFeeds(user.id, filter);
  const since = new Date();
  // ponytail: awaited so the result message is real; move to after() + polling past ~150 feeds
  await refreshFeeds(
    feeds.map(({ id }) => id),
    { force: true }
  );
  const newItems = await countNewItems(user.id, filter, since);
  refresh();
  return { feeds: feeds.length, newItems };
}

export async function checkNewItems(search: string, since: number) {
  const user = await requireUser();
  const date = validDate(since);
  if (!date) return 0;
  const filter = filterFromSearch(search);
  const now = new Date();
  const due = (await scopedFeeds(user.id, filter)).filter(({ nextFetchAt }) => nextFetchAt <= now);
  after(() => refreshFeeds(due.map(({ id }) => id)));
  return countNewItems(user.id, filter, date);
}

export async function loadNewItems(search: string, since: number) {
  const user = await requireUser();
  const fetchedAt = Date.now();
  const date = validDate(since);
  if (!date) return { items: [], fetchedAt };
  return { items: await listNewItems(user.id, filterFromSearch(search), date), fetchedAt };
}

export async function setLayoutAction(layout: string) {
  const user = await requireUser();
  await setPreferences(user.id, { layout: parseLayout(layout) });
  refresh();
}

export async function finishDigestAction(itemIds: string[]) {
  const user = await requireUser();
  const ids = Array.isArray(itemIds)
    ? itemIds.filter((id) => ID_PATTERN.test(id)).slice(0, 500)
    : [];
  if (ids.length) await markItemsRead(user.id, ids);
  await setPreferences(user.id, { digestSeenAt: new Date() });
  refresh();
}
