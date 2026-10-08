'use client';

import { useEffect, useState, useTransition } from 'react';
import { markAllReadAction, undoMarkAllReadAction } from '@/app/app/actions';
import { useReadState } from '@/components/ReadState';

const UNDO_MS = 5_000;

interface Toast {
  message: string;
  markedAt?: string;
  snapshot?: Record<string, boolean>;
}

export default function MarkAllRead({ search, label }: { search: string; label: string }) {
  const { markAllRead, restore } = useReadState();
  const [seenAt] = useState(() => Date.now());
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<Toast | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!toast || paused) return undefined;
    const timer = setTimeout(() => setToast(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [toast, paused]);

  const markAll = () => {
    if (isPending) return;
    const snapshot = markAllRead();
    startTransition(async () => {
      const { count, markedAt } = await markAllReadAction(search, seenAt);
      setToast(
        count
          ? {
              message: `Marked ${count} ${count === 1 ? 'item' : 'items'} read`,
              markedAt,
              snapshot,
            }
          : { message: 'Nothing left to mark read' }
      );
    });
  };

  const undo = ({ markedAt, snapshot }: Toast) => {
    if (!markedAt) return;
    setToast(null);
    setPaused(false);
    startTransition(async () => {
      restore(snapshot ?? {}, await undoMarkAllReadAction(markedAt));
      setToast({ message: 'Restored unread items' });
    });
  };

  return (
    <>
      <button
        type='button'
        onClick={markAll}
        aria-disabled={isPending}
        className='min-h-11 rounded-md border border-border px-3 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary aria-disabled:opacity-60'
      >
        {label}
      </button>
      <div
        aria-live='polite'
        className='pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-center'
      >
        {toast && (
          <p
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
            className='pointer-events-auto flex items-center gap-3 rounded-lg bg-text-primary px-4 py-2 text-sm text-bg-primary shadow-lg'
          >
            {toast.message}
            {toast.markedAt && (
              <button
                type='button'
                onClick={() => undo(toast)}
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
