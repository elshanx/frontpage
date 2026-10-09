'use client';

import { useState, useTransition } from 'react';
import { refreshAction } from '@/app/app/actions';
import { useAnnounce } from '@/components/Announcer';
import { relativeTime } from '@/lib/reading/format';

const fullDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export const REFRESHED_EVENT = 'frontpage:refreshed';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function RefreshButton({
  search,
  lastUpdated,
  now,
}: {
  search: string;
  lastUpdated: number | null;
  now: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState('');
  const announce = useAnnounce();
  const report = (text: string) => {
    setMessage(text);
    announce(text);
  };

  const refreshFeeds = () => {
    if (isPending) return;
    setMessage('');
    startTransition(async () => {
      try {
        const { feeds, newItems } = await refreshAction(search);
        report(
          newItems
            ? `Refreshed ${plural(feeds, 'feed')} · ${plural(newItems, 'new item')}`
            : 'Already up to date'
        );
        if (newItems) window.dispatchEvent(new Event(REFRESHED_EVENT));
      } catch {
        report("We couldn't refresh. Try again.");
      }
    });
  };

  return (
    <div className='flex items-center gap-2 text-sm'>
      {lastUpdated && (
        <span className='text-text-tertiary'>
          Updated{' '}
          <time
            dateTime={new Date(lastUpdated).toISOString()}
            title={fullDate.format(lastUpdated)}
            suppressHydrationWarning
          >
            {relativeTime(new Date(lastUpdated), new Date(now))}
          </time>
        </span>
      )}
      <button
        type='button'
        onClick={refreshFeeds}
        aria-disabled={isPending}
        className='flex min-h-11 items-center gap-2 rounded-md border border-border px-3 font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary aria-disabled:opacity-60'
      >
        <svg
          aria-hidden='true'
          viewBox='0 0 16 16'
          className={`size-4 fill-none stroke-current stroke-[1.5] ${isPending ? 'motion-safe:animate-spin' : ''}`}
        >
          <path d='M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3h-3' />
        </svg>
        {isPending ? 'Refreshing…' : 'Refresh'}
      </button>
      <span className='text-text-secondary'>{message}</span>
    </div>
  );
}
