'use server';

import { after } from 'next/server';
import { refresh } from 'next/cache';
import parseCategoryName from '@/lib/manage/names';
import { ID_PATTERN } from '@/lib/reading/filters';
import { refreshFeeds } from '@/lib/refresh';
import { requireUser } from '@/lib/session';
import {
  createCategory,
  deleteCategory,
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
