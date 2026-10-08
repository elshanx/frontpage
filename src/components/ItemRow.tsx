'use client';

import Link from 'next/link';
import { setReadAction } from '@/app/app/actions';
import FeedIcon from '@/components/FeedIcon';
import { useReadState } from '@/components/ReadState';
import type { ListedItem } from '@/lib/items';
import { relativeTime } from '@/lib/reading/format';

const fullDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export default function ItemRow({
  item,
  search,
  now,
}: {
  item: ListedItem;
  search: string;
  now: number;
}) {
  const { isUnread, setUnread } = useReadState();
  const unread = isUnread(item.id, item.unread);

  const toggle = () => {
    setUnread(item.id, !unread);
    setReadAction(item.id, unread);
  };
  const openOriginal = () => {
    if (!unread) return;
    setUnread(item.id, false);
    setReadAction(item.id, true);
  };

  return (
    <li className='border-b border-border-subtle [contain-intrinsic-size:auto_7rem] [content-visibility:auto]'>
      <article className='flex gap-3 py-3'>
        <span
          aria-hidden='true'
          className={`mt-2 size-2 shrink-0 rounded-full ${unread ? 'bg-unread' : 'bg-transparent'}`}
        />
        <div className='min-w-0 flex-1'>
          <h2 className='text-base'>
            <Link
              href={`/app/item/${item.id}${search}`}
              onClick={() => setUnread(item.id, false)}
              className={`transition-colors duration-150 hover:text-accent ${unread ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}
            >
              {unread && <span className='sr-only'>Unread: </span>}
              {item.title}
            </Link>
          </h2>
          <p className='mt-1 flex min-w-0 items-center gap-1.5 text-sm text-text-tertiary'>
            <FeedIcon src={item.iconUrl} title={item.feedTitle} />
            <span className='truncate'>{item.feedTitle}</span>
            <span aria-hidden='true'>·</span>
            <time
              dateTime={item.publishedAt.toISOString()}
              title={fullDate.format(item.publishedAt)}
              suppressHydrationWarning
              className='shrink-0'
            >
              {relativeTime(item.publishedAt, new Date(now))}
            </time>
          </p>
          {item.excerpt && (
            <p className='mt-1 line-clamp-2 text-sm text-text-secondary max-sm:hidden'>
              {item.excerpt}
            </p>
          )}
        </div>
        <div className='flex shrink-0 items-start gap-1'>
          <button
            type='button'
            onClick={toggle}
            title={unread ? 'Mark as read' : 'Mark as unread'}
            className='grid size-9 place-items-center rounded-md text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary pointer-coarse:size-11'
          >
            <span
              aria-hidden='true'
              className={`size-3 rounded-full border-2 border-current ${unread ? '' : 'bg-current'}`}
            />
            <span className='sr-only'>{unread ? 'Mark as read' : 'Mark as unread'}</span>
          </button>
          {item.url && (
            <a
              href={item.url}
              target='_blank'
              rel='noopener noreferrer'
              onClick={openOriginal}
              title='Open original'
              className='grid size-9 place-items-center rounded-md text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary pointer-coarse:size-11'
            >
              <svg
                aria-hidden='true'
                viewBox='0 0 16 16'
                className='size-4 fill-none stroke-current stroke-[1.5]'
              >
                <path d='M9 2.75h4.25V7M13 3 7.5 8.5M11.25 9.5v3.75h-8.5v-8.5H6.5' />
              </svg>
              <span className='sr-only'>Open original (new tab)</span>
            </a>
          )}
        </div>
      </article>
    </li>
  );
}
