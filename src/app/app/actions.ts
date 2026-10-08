'use server';

import { refresh } from 'next/cache';
import { after } from 'next/server';
import { findBriefing, saveBriefing } from '@/lib/ai/briefing';
import { generate } from '@/lib/ai/client';
import type { AiOutcome } from '@/lib/ai/outcome';
import { loadDigest, parseDigestWindow } from '@/lib/digest-data';
import { toPlainText } from '@/lib/feeds/html';
import {
  countNewItems,
  getItemForUser,
  listItems,
  listNewItems,
  markAllRead,
  markItemsRead,
  saveSummary,
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

const SUMMARY_PROMPT =
  'Summarize the article for a busy reader in two short paragraphs of plain text. No preamble, no headings, no bullet points. Stick to what the article says.';
const MAX_ARTICLE_CHARS = 60_000;

export async function summarizeItemAction(itemId: string): Promise<AiOutcome> {
  const user = await requireUser();
  if (!ID_PATTERN.test(itemId)) return { status: 'unavailable' };
  const item = await getItemForUser(user.id, itemId);
  if (!item) return { status: 'unavailable' };
  if (item.aiSummary) return { status: 'ok', text: item.aiSummary };
  const article = toPlainText(item.contentHtml ?? item.excerpt ?? '').slice(0, MAX_ARTICLE_CHARS);
  if (!article) return { status: 'unavailable' };
  const outcome = await generate(user, SUMMARY_PROMPT, `Title: ${item.title}\n\n${article}`);
  if (outcome.status === 'ok') await saveSummary(item.id, outcome.text);
  return outcome;
}

const BRIEFING_PROMPT =
  'You write a short "what happened" briefing for a tech reader. Given headlines and excerpts, write one plain-text paragraph of 3 to 5 sentences that connects the main themes. No preamble, no lists, no headings. Only use what the items say.';
const BRIEFING_ITEMS = 20;

export async function briefDigestAction(window: string): Promise<AiOutcome> {
  const user = await requireUser();
  const { shown, windowKey } = await loadDigest(user.id, parseDigestWindow(window));
  if (!shown.length) return { status: 'unavailable' };
  const cached = await findBriefing(user.id, windowKey);
  if (cached) return { status: 'ok', text: cached };
  const input = shown
    .slice(0, BRIEFING_ITEMS)
    .map(
      ({ title, feedTitle, excerpt }) => `- ${title} (${feedTitle})${excerpt ? `: ${excerpt}` : ''}`
    )
    .join('\n');
  const outcome = await generate(user, BRIEFING_PROMPT, input);
  if (outcome.status === 'ok') await saveBriefing(user.id, windowKey, outcome.text);
  return outcome;
}
