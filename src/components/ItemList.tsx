import { after } from 'next/server';
import { setTimeout } from 'node:timers/promises';
import { feedsToRefresh, listItems } from '@/lib/items';
import { refreshFeeds } from '@/lib/refresh';

const INITIAL_WAIT_MS = 8_000;
const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });

export default async function ItemList({ userId }: { userId: string }) {
  const { neverFetched, due } = await feedsToRefresh(userId);
  const initialRefresh = refreshFeeds(neverFetched);
  after(() => Promise.all([initialRefresh, refreshFeeds(due)]));
  await Promise.race([initialRefresh, setTimeout(INITIAL_WAIT_MS)]);
  const items = await listItems(userId);

  if (!items.length) {
    return (
      <p className='py-12 text-center text-text-secondary'>
        No items yet. Your feeds are still loading.
      </p>
    );
  }

  return (
    <ul className='divide-y divide-border-subtle'>
      {items.map((item) => (
        <li key={item.id} className='py-4'>
          <article>
            <h2 className='text-lg font-medium'>
              {item.url ? (
                <a
                  href={item.url}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='hover:text-accent'
                >
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </h2>
            <p className='mt-1 text-xs text-text-tertiary'>
              {item.feed.title} ·{' '}
              <time dateTime={item.publishedAt.toISOString()}>
                {dateFormat.format(item.publishedAt)}
              </time>
            </p>
            {item.excerpt && (
              <p className='mt-1 line-clamp-2 text-sm text-text-secondary'>{item.excerpt}</p>
            )}
          </article>
        </li>
      ))}
    </ul>
  );
}
