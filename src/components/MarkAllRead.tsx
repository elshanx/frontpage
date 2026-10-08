'use client';

import { useEffect, useState, useTransition } from 'react';
import { markAllReadAction, undoMarkAllReadAction } from '@/app/app/actions';
import { useReadState } from '@/components/ReadState';

const UNDO_MS = 5_000;

export default function MarkAllRead({ search, label }: { search: string; label: string }) {
  const { setAllRead } = useReadState();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ message: string; markedAt?: string } | null>(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const markAll = () =>
    startTransition(async () => {
      setAllRead(true);
      const { count, markedAt } = await markAllReadAction(search);
      setToast(
        count
          ? { message: `Marked ${count} ${count === 1 ? 'item' : 'items'} read`, markedAt }
          : { message: 'Nothing left to mark read' }
      );
    });

  const undo = (markedAt: string) =>
    startTransition(async () => {
      setToast(null);
      await undoMarkAllReadAction(markedAt);
      setAllRead(false);
      setToast({ message: 'Restored unread items' });
    });

  return (
    <>
      <button
        type='button'
        onClick={markAll}
        disabled={isPending}
        className='min-h-11 rounded-md border border-border px-3 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-60'
      >
        {label}
      </button>
      <div
        aria-live='polite'
        className='pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center'
      >
        {toast && (
          <p className='pointer-events-auto flex items-center gap-3 rounded-lg bg-text-primary px-4 py-2 text-sm text-bg-primary shadow-lg'>
            {toast.message}
            {toast.markedAt && (
              <button
                type='button'
                onClick={() => undo(toast.markedAt as string)}
                className='min-h-9 rounded-md px-2 font-semibold underline'
              >
                Undo
              </button>
            )}
          </p>
        )}
      </div>
    </>
  );
}
