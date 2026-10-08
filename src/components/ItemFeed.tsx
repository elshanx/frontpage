'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { loadItems } from '@/app/app/actions';
import ItemRow from '@/components/ItemRow';
import type { ListedItem } from '@/lib/items';

export default function ItemFeed({
  initial,
  search,
  now,
}: {
  initial: { items: ListedItem[]; nextCursor: string | null };
  search: string;
  now: number;
}) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);

  const loadMore = () => {
    if (!cursor || isPending) return;
    startTransition(async () => {
      try {
        const page = await loadItems(search, cursor);
        setItems((current) => {
          const seen = new Set(current.map(({ id }) => id));
          return [...current, ...page.items.filter(({ id }) => !seen.has(id))];
        });
        setCursor(page.nextCursor);
        setFailed(false);
      } catch {
        setFailed(true);
      }
    });
  };

  let buttonLabel = failed ? 'Try again' : 'Load more';
  if (isPending) buttonLabel = 'Loading more…';

  useEffect(() => {
    const target = sentinel.current;
    if (!target || !cursor || failed) return undefined;
    const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && loadMore(), {
      rootMargin: '600px',
    });
    observer.observe(target);
    return () => observer.disconnect();
  });

  return (
    <>
      <ul>
        {items.map((item) => (
          <ItemRow key={item.id} item={item} search={search} now={now} />
        ))}
      </ul>
      {cursor ? (
        <div ref={sentinel} className='flex flex-col items-center gap-2 py-6'>
          {failed && (
            <p role='alert' className='text-sm text-error'>
              We couldn&apos;t load more items.
            </p>
          )}
          <button
            type='button'
            onClick={loadMore}
            disabled={isPending}
            className='min-h-11 rounded-md px-4 text-sm font-medium text-accent hover:bg-accent-subtle disabled:opacity-60'
          >
            {buttonLabel}
          </button>
        </div>
      ) : (
        <p className='py-6 text-center text-sm text-text-tertiary'>You&apos;re all caught up.</p>
      )}
    </>
  );
}
