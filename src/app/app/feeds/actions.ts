'use server';

import { after } from 'next/server';
import { refresh } from 'next/cache';
import parseCategoryName from '@/lib/manage/names';
import parseOpml, { type OpmlEntry, OpmlError } from '@/lib/opml/parse';
import planImport, { type ImportRow } from '@/lib/opml/plan';
import { ID_PATTERN } from '@/lib/reading/filters';
import { refreshFeeds } from '@/lib/refresh';
import { requireUser } from '@/lib/session';
import {
  createCategory,
  deleteCategory,
  importOpml,
  listManagedFeeds,
  type FeedPreview,
  moveCategory,
  renameCategory,
  retryFeed,
  subscribe,
  subscribeStarterPack,
  unsubscribe,
  updateSubscription,
} from '@/lib/subscriptions';

export type AddFeedState =
  | { status: 'idle' }
  | { status: 'added'; feed: FeedPreview }
  | { status: 'error'; message: string; url: string };

export interface FormState {
  error: string | null;
}

const text = (formData: FormData, name: string) => {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
};

const optionalId = (formData: FormData, name: string) => {
  const value = text(formData, name);
  return ID_PATTERN.test(value) ? value : null;
};

export async function addFeedAction(_: AddFeedState, formData: FormData): Promise<AddFeedState> {
  const user = await requireUser();
  const url = text(formData, 'url').trim();
  if (!url) return { status: 'error', message: 'Enter a feed or website address', url };
  const result = await subscribe(user.id, url, optionalId(formData, 'categoryId'));
  if (!result.ok) return { status: 'error', message: result.message, url };
  refresh();
  return { status: 'added', feed: result.feed };
}

export async function updateSubscriptionAction(formData: FormData) {
  const user = await requireUser();
  const id = optionalId(formData, 'id');
  if (!id) return;
  const title = text(formData, 'title').trim().slice(0, 200) || null;
  await updateSubscription(user.id, id, { title, categoryId: optionalId(formData, 'categoryId') });
  refresh();
}

export async function unsubscribeAction(formData: FormData) {
  const user = await requireUser();
  const id = optionalId(formData, 'id');
  if (!id) return;
  await unsubscribe(user.id, id);
  refresh();
}

export async function retryFeedAction(subscriptionId: string) {
  const user = await requireUser();
  if (!ID_PATTERN.test(subscriptionId)) return { retried: false };
  const result = await retryFeed(user.id, subscriptionId);
  refresh();
  return result;
}

export async function createCategoryAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = parseCategoryName(formData.get('name'));
  if (!name) return { error: 'Enter a name up to 40 characters' };
  const error = await createCategory(user.id, name);
  if (!error) refresh();
  return { error };
}

export async function renameCategoryAction(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = optionalId(formData, 'id');
  const name = parseCategoryName(formData.get('name'));
  if (!id || !name) return { error: 'Enter a name up to 40 characters' };
  const error = await renameCategory(user.id, id, name);
  if (!error) refresh();
  return { error };
}

export async function deleteCategoryAction(formData: FormData) {
  const user = await requireUser();
  const id = optionalId(formData, 'id');
  if (!id) return;
  await deleteCategory(user.id, id);
  refresh();
}

export async function moveCategoryAction(categoryId: string, direction: 'up' | 'down') {
  const user = await requireUser();
  if (!ID_PATTERN.test(categoryId) || (direction !== 'up' && direction !== 'down')) return;
  await moveCategory(user.id, categoryId, direction);
  refresh();
}

export async function subscribeStarterPackAction(formData: FormData) {
  const user = await requireUser();
  const feedIds = await subscribeStarterPack(user.id, text(formData, 'name'));
  after(() => refreshFeeds(feedIds));
  refresh();
}

const MAX_OPML_BYTES = 1024 * 1024;
const MAX_OPML_ENTRIES = 200;

export type OpmlPreviewState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'preview'; rows: ImportRow[] };

export async function previewOpmlAction(
  _: OpmlPreviewState,
  formData: FormData
): Promise<OpmlPreviewState> {
  const user = await requireUser();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'Choose an OPML file to import' };
  }
  if (file.size > MAX_OPML_BYTES)
    return { status: 'error', message: 'The file is larger than 1 MB' };
  let entries: OpmlEntry[];
  try {
    entries = parseOpml(await file.text());
  } catch (error) {
    if (error instanceof OpmlError) return { status: 'error', message: error.message };
    throw error;
  }
  if (!entries.length) return { status: 'error', message: 'No feeds were found in this file' };
  if (entries.length > MAX_OPML_ENTRIES) {
    return { status: 'error', message: `This file has more than ${MAX_OPML_ENTRIES} feeds` };
  }
  const { feeds } = await listManagedFeeds(user.id);
  return {
    status: 'preview',
    rows: planImport(
      entries,
      feeds.map(({ url }) => url)
    ),
  };
}

const isEntry = (value: unknown): value is OpmlEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const { url, title, category } = value as Record<string, unknown>;
  return (
    typeof url === 'string' &&
    url.length <= 2048 &&
    (title === null || typeof title === 'string') &&
    (category === null || typeof category === 'string')
  );
};

export async function importOpmlAction(entries: unknown) {
  const user = await requireUser();
  if (!Array.isArray(entries) || entries.length > MAX_OPML_ENTRIES || !entries.every(isEntry)) {
    return { added: 0, duplicates: 0, invalid: [] };
  }
  const { feedIds, ...result } = await importOpml(user.id, entries);
  after(() => refreshFeeds(feedIds));
  refresh();
  return result;
}
