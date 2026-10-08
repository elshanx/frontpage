'use client';

import { useOptimistic, useTransition } from 'react';
import { setSavedAction } from '@/app/app/actions';

export default function SaveButton({ itemId, saved }: { itemId: string; saved: boolean }) {
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);
  const [, startTransition] = useTransition();
  const label = optimisticSaved ? 'Remove from saved' : 'Save for later';

  const toggle = () =>
    startTransition(async () => {
      setOptimisticSaved(!optimisticSaved);
      await setSavedAction(itemId, !optimisticSaved);
    });

  return (
    <button
      type='button'
      onClick={toggle}
      aria-pressed={optimisticSaved}
      title={label}
      className='grid size-9 place-items-center rounded-md text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary aria-pressed:text-accent pointer-coarse:size-11'
    >
      <svg
        aria-hidden='true'
        viewBox='0 0 16 16'
        className={`size-4 stroke-current stroke-[1.5] ${optimisticSaved ? 'fill-current' : 'fill-none'}`}
      >
        <path d='M4 2.75h8v10.5l-4-2.75-4 2.75V2.75Z' strokeLinejoin='round' />
      </svg>
      <span className='sr-only'>Save</span>
    </button>
  );
}
