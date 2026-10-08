'use server';

import { refresh } from 'next/cache';
import {
  listItems,
  markAllRead,
  searchItems,
  setRead,
  setSaved,
  undoMarkAllRead,
} from '@/lib/items';
import { decodeCursor } from '@/lib/reading/cursor';
import { ID_PATTERN, parseListFilter } from '@/lib/reading/filters';
import { parseSearchParams } from '@/lib/search/query';
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

export async function searchAction(search: string) {
  const user = await requireUser();
  if (typeof search !== 'string') return [];
  return searchItems(user.id, parseSearchParams(Object.fromEntries(new URLSearchParams(search))));
}
