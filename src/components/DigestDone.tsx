'use client';

import { useTransition } from 'react';
import { finishDigestAction } from '@/app/app/actions';

export default function DigestDone({ itemIds }: { itemIds: string[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type='button'
      onClick={() => startTransition(() => finishDigestAction(itemIds))}
      aria-disabled={isPending}
      className='min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover aria-disabled:opacity-60'
    >
      {isPending ? 'Marking read…' : `Done — mark ${itemIds.length} read`}
    </button>
  );
}
