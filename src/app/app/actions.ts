'use server';

import { refresh } from 'next/cache';
import { listItems, markAllRead, setRead, undoMarkAllRead } from '@/lib/items';
import { decodeCursor } from '@/lib/reading/cursor';
import { ID_PATTERN, parseListFilter } from '@/lib/reading/filters';
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

export async function markAllReadAction(search: string) {
  const user = await requireUser();
  const { count, markedAt } = await markAllRead(user.id, filterFromSearch(search));
  refresh();
  return { count, markedAt: markedAt.toISOString() };
}

export async function undoMarkAllReadAction(markedAt: string) {
  const user = await requireUser();
  const date = new Date(markedAt);
  if (Number.isNaN(date.getTime())) return;
  await undoMarkAllRead(user.id, date);
  refresh();
}
