'use client';

import { useState, useTransition } from 'react';
import { retryFeedAction, unsubscribeAction } from '@/app/app/feeds/actions';
import type { CategoryOption } from '@/components/CategorySelect';
import ConfirmDialog, { buttonClass } from '@/components/ConfirmDialog';
import EditFeedDialog from '@/components/EditFeedDialog';
import FeedIcon from '@/components/FeedIcon';
import HealthBadge from '@/components/HealthBadge';
import { relativeTime } from '@/lib/reading/format';
import type { ManagedFeed } from '@/lib/subscriptions';

export default function FeedRow({
  feed,
  categories,
  now,
}: {
  feed: ManagedFeed;
  categories: CategoryOption[];
  now: Date;
}) {
  const [isRetrying, startRetry] = useTransition();
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const failing = feed.health === 'error' || feed.health === 'dead';

  const retry = () =>
    startRetry(async () => {
      setRetryMessage(null);
      const { retried } = await retryFeedAction(feed.id);
      setRetryMessage(retried ? 'Retried just now' : 'Retried less than a minute ago');
    });

  return (
    <li className='flex flex-col gap-2 border-b border-border-subtle py-4 sm:flex-row sm:items-start sm:justify-between'>
      <div className='flex min-w-0 gap-3'>
        <span className='mt-1'>
          <FeedIcon src={feed.iconUrl} title={feed.title} />
        </span>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
            <h3 className='truncate font-medium'>{feed.title}</h3>
            <HealthBadge health={feed.health} />
          </div>
          <p className='text-xs text-text-tertiary'>
            {feed.lastSuccessAt ? (
              <>
                Last updated{' '}
                <time
                  dateTime={feed.lastSuccessAt.toISOString()}
                  title={feed.lastSuccessAt.toLocaleString('en')}
                >
                  {relativeTime(feed.lastSuccessAt, now)}
                </time>
              </>
            ) : (
              'Never fetched successfully'
            )}
          </p>
          {failing && feed.lastError && <p className='mt-1 text-sm text-error'>{feed.lastError}</p>}
          <p aria-live='polite' className='text-xs text-text-secondary'>
            {retryMessage}
          </p>
        </div>
      </div>
      <div className='flex shrink-0 flex-wrap gap-2'>
        {feed.health !== 'active' && feed.health !== 'pending' && (
          <button
            type='button'
            onClick={retry}
            disabled={isRetrying}
            aria-label={`Retry ${feed.title}`}
            className={buttonClass}
          >
            {isRetrying ? 'Retrying…' : 'Retry'}
          </button>
        )}
        <EditFeedDialog feed={feed} categories={categories} />
        <ConfirmDialog
          trigger='Remove'
          triggerLabel={`Remove ${feed.title}`}
          title={`Unsubscribe from ${feed.title}?`}
          confirm='Unsubscribe'
          action={unsubscribeAction}
          fields={{ id: feed.id }}
        >
          Its items and your read history for it will be removed.
        </ConfirmDialog>
      </div>
    </li>
  );
}
