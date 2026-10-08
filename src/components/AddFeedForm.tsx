'use client';

import { useActionState, useId } from 'react';
import { type AddFeedState, addFeedAction } from '@/app/app/feeds/actions';
import CategorySelect, { type CategoryOption } from '@/components/CategorySelect';
import FeedIcon from '@/components/FeedIcon';
import SubmitButton from '@/components/SubmitButton';

const initialState: AddFeedState = { status: 'idle' };

export default function AddFeedForm({ categories }: { categories: CategoryOption[] }) {
  const [state, formAction, isPending] = useActionState(addFeedAction, initialState);
  const id = useId();
  const error = state.status === 'error' ? state.message : null;

  return (
    <div className='flex flex-col gap-4'>
      <form action={formAction} className='flex flex-col gap-4 sm:flex-row sm:items-end'>
        <label htmlFor={id} className='flex flex-1 flex-col gap-1'>
          <span className='text-sm font-medium'>Feed or website address</span>
          <input
            id={id}
            name='url'
            type='url'
            inputMode='url'
            required
            placeholder='https://example.com/feed.xml'
            defaultValue={state.status === 'error' ? state.url : ''}
            key={state.status === 'error' ? state.url : 'empty'}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${id}-error` : undefined}
            className='min-h-11 rounded-md border border-border bg-surface px-3 text-base aria-invalid:border-error'
          />
        </label>
        <div className='sm:w-48'>
          <CategorySelect categories={categories} />
        </div>
        <SubmitButton isPending={isPending} label='Add feed' pendingLabel='Checking feed…' />
      </form>
      <div aria-live='polite'>
        {error && (
          <p id={`${id}-error`} className='text-sm text-error'>
            {error}
          </p>
        )}
        {state.status === 'added' && (
          <div className='flex gap-3 rounded-lg border border-border-subtle bg-bg-secondary p-4'>
            <FeedIcon src={state.feed.iconUrl} title={state.feed.title} />
            <div className='min-w-0'>
              <p className='font-semibold'>Added {state.feed.title}</p>
              {state.feed.description && (
                <p className='mt-1 line-clamp-2 text-sm text-text-secondary'>
                  {state.feed.description}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
