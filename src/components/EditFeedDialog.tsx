'use client';

import { useId, useRef } from 'react';
import { updateSubscriptionAction } from '@/app/app/feeds/actions';
import { buttonClass } from '@/components/ConfirmDialog';
import CategorySelect, { type CategoryOption } from '@/components/CategorySelect';
import type { ManagedFeed } from '@/lib/subscriptions';

export default function EditFeedDialog({
  feed,
  categories,
}: {
  feed: ManagedFeed;
  categories: CategoryOption[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  return (
    <>
      <button
        type='button'
        aria-label={`Edit ${feed.title}`}
        onClick={() => dialog.current?.showModal()}
        className={buttonClass}
      >
        Edit
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        className='m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg bg-surface p-5 text-text-primary shadow-lg backdrop:bg-black/40'
      >
        <h2 id={`${id}-title`} className='text-lg font-semibold'>
          Edit feed
        </h2>
        <form
          action={async (formData) => {
            await updateSubscriptionAction(formData);
            dialog.current?.close();
          }}
          className='mt-4 flex flex-col gap-4'
        >
          <input type='hidden' name='id' value={feed.id} />
          <div className='flex flex-col gap-1'>
            <label htmlFor={`${id}-name`} className='flex flex-col gap-1'>
              <span className='text-sm font-medium'>Title</span>
              <input
                id={`${id}-name`}
                name='title'
                defaultValue={feed.customTitle ?? ''}
                placeholder={feed.feedTitle}
                maxLength={200}
                aria-describedby={`${id}-hint`}
                className='min-h-11 rounded-md border border-border bg-surface px-3 text-base'
              />
            </label>
            <p id={`${id}-hint`} className='text-xs text-text-tertiary'>
              Leave empty to use the feed&apos;s own title.
            </p>
          </div>
          <CategorySelect categories={categories} defaultValue={feed.categoryId} />
          <div className='flex justify-end gap-2'>
            <button type='button' onClick={() => dialog.current?.close()} className={buttonClass}>
              Cancel
            </button>
            <button
              type='submit'
              className='min-h-9 rounded-md bg-accent px-3 text-sm font-semibold text-white hover:bg-accent-hover pointer-coarse:min-h-11'
            >
              Save
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
