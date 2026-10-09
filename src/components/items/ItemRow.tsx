'use client';

import Link from 'next/link';
import { setReadAction } from '@/app/app/actions';
import FeedIcon from '@/components/feeds/FeedIcon';
import SaveButton from '@/components/items/SaveButton';
import { useReadState } from '@/components/items/ReadState';
import type { ListedItem } from '@/lib/items';
import { categoryColor, relativeTime } from '@/lib/reading/format';
import type { Layout } from '@/lib/reading/layout';

const fullDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export default function ItemRow({
  item,
  search,
  now,
  layout,
}: {
  item: ListedItem;
  search: string;
  now: number;
  layout: Layout;
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

  const heading = (
    <h2 className='text-base'>
      <Link
        href={`/app/item/${item.id}${search}`}
        onClick={() => setUnread(item.id, false)}
        data-action='open'
        className={`transition-colors duration-150 hover:text-accent ${layout === 'cards' ? 'after:absolute after:inset-0' : ''} ${unread ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}
      >
        {unread && <span className='sr-only'>Unread: </span>}
        {item.title}
      </Link>
    </h2>
  );
  const meta = (
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
  );
  const actions = (
    <div className='flex shrink-0 items-start gap-1 transition-opacity pointer-fine:opacity-0 pointer-fine:group-focus-within:opacity-100 pointer-fine:group-hover:opacity-100'>
      <SaveButton itemId={item.id} saved={item.saved} />
      <button
        type='button'
        onClick={toggle}
        data-action='read'
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
  );
  const dot = (
    <span
      aria-hidden='true'
      className={`mt-2 size-2 shrink-0 rounded-full ${unread ? 'bg-unread' : 'bg-transparent'}`}
    />
  );

  if (layout === 'cards') {
    return (
      <li
        data-item-row
        className='group relative flex flex-col overflow-hidden rounded-lg border hover:border-text-tertiary border-border-subtle bg-bg-secondary has-[[data-action=open]:focus-visible]:bg-accent-subtle'
      >
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- images come from arbitrary feed hosts
          <img
            src={item.imageUrl}
            alt=''
            loading='lazy'
            className='aspect-video w-full bg-bg-tertiary object-cover'
          />
        ) : (
          <div
            aria-hidden='true'
            className='flex aspect-video items-center justify-center px-6 text-center text-lg font-semibold text-balance text-text-primary/80'
            style={{
              background: `linear-gradient(135deg, ${categoryColor(item.feedTitle)}33, ${categoryColor(item.feedTitle)}0d)`,
            }}
          >
            <span className='line-clamp-3'>{item.title}</span>
          </div>
        )}
        <article className='flex flex-1 flex-col gap-1 p-3'>
          <div className='flex gap-2'>
            {unread && dot}
            {heading}
          </div>
          {meta}
          <div className='relative z-10 mt-auto flex justify-end pt-2'>{actions}</div>
        </article>
      </li>
    );
  }

  if (layout === 'compact') {
    return (
      <li
        data-item-row
        className='group border-b border-border-subtle [contain-intrinsic-size:auto_3rem] [content-visibility:auto] has-[[data-action=open]:focus-visible]:bg-accent-subtle'
      >
        <article className='flex items-center gap-3 py-1'>
          <span
            aria-hidden='true'
            className={`size-2 shrink-0 rounded-full ${unread ? 'bg-unread' : 'bg-transparent'}`}
          />
          <div className='flex min-w-0 flex-1 items-baseline gap-3 max-sm:flex-col max-sm:gap-0 [&>h2]:min-w-0 [&>h2]:flex-1 [&>h2]:truncate [&>p]:mt-0 [&>p]:max-w-[45%]'>
            {heading}
            {meta}
          </div>
          {actions}
        </article>
      </li>
    );
  }

  return (
    <li
      data-item-row
      className='group border-b border-border-subtle [contain-intrinsic-size:auto_7rem] [content-visibility:auto] has-[[data-action=open]:focus-visible]:bg-accent-subtle'
    >
      <article className='flex gap-3 py-3'>
        {dot}
        <div className='min-w-0 flex-1 [&>p:first-child]:mt-0 [&>p:first-child]:mb-1'>
          {meta}
          {heading}
          {item.excerpt && (
            <p className='mt-1 line-clamp-2 max-w-3xl text-[0.9375rem] text-text-secondary max-sm:hidden'>
              {item.excerpt}
            </p>
          )}
          {item.categoryName && (
            <span
              className='mt-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium'
              style={{
                color: categoryColor(item.categoryName),
                backgroundColor: `${categoryColor(item.categoryName)}22`,
              }}
            >
              {item.categoryName}
            </span>
          )}
        </div>
        {item.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- images come from arbitrary feed hosts
          <img
            src={item.imageUrl}
            alt=''
            loading='lazy'
            className='mt-1 h-14 w-20 shrink-0 rounded-md bg-bg-tertiary object-cover max-sm:hidden'
          />
        )}
        {actions}
      </article>
    </li>
  );
}
