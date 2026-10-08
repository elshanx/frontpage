import Link from 'next/link';
import { after } from 'next/server';
import { setTimeout } from 'node:timers/promises';
import ItemFeed from '@/components/ItemFeed';
import { feedsToRefresh, listItems } from '@/lib/items';
import { type ListFilter, filterToSearch } from '@/lib/reading/filters';
import { refreshFeeds } from '@/lib/refresh';

const INITIAL_WAIT_MS = 8_000;

export default async function ItemList({
  userId,
  filter,
  refreshMinutes,
}: {
  userId: string;
  filter: ListFilter;
  refreshMinutes: number;
}) {
  const { neverFetched, due } = await feedsToRefresh(userId);
  const initialRefresh = refreshFeeds(neverFetched);
  after(() => Promise.all([initialRefresh, refreshFeeds(due)]));
  await Promise.race([initialRefresh, setTimeout(INITIAL_WAIT_MS)]);
  const page = await listItems(userId, filter, null);
  const search = filterToSearch(filter);

  if (!page.items.length) {
    return filter.unreadOnly ? (
      <p className='py-12 text-center text-text-secondary'>
        No unread items here.{' '}
        <Link
          href={`/app${filterToSearch({ ...filter, unreadOnly: false })}`}
          className='font-semibold text-accent underline'
        >
          Show all items
        </Link>
      </p>
    ) : (
      <p className='py-12 text-center text-text-secondary'>
        No items yet. Your feeds are still loading.
      </p>
    );
  }

  return (
    <ItemFeed initial={page} search={search} now={page.fetchedAt} refreshMinutes={refreshMinutes} />
  );
}
