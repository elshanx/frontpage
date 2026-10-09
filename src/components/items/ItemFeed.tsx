'use client';

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { checkNewItems, loadItems, loadNewItems } from '@/app/app/actions';
import { useAnnounce } from '@/components/Announcer';
import ItemRow from '@/components/items/ItemRow';
import { REFRESHED_EVENT } from '@/components/feeds/RefreshButton';
import type { ListedItem } from '@/lib/items';
import type { Layout } from '@/lib/reading/layout';

const FOCUS_CHECK_MS = 60_000;

const newestFirst = (a: ListedItem, b: ListedItem) =>
  new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime() || b.id.localeCompare(a.id);

export default function ItemFeed({
  initial,
  search,
  now,
  refreshMinutes,
  layout,
}: {
  initial: { items: ListedItem[]; nextCursor: string | null; fetchedAt: number };
  search: string;
  now: number;
  refreshMinutes: number;
  layout: Layout;
}) {
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [failed, setFailed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);
  const since = useRef(initial.fetchedAt);
  const lastCheck = useRef(initial.fetchedAt);
  const heightBeforeInsert = useRef<number | null>(null);
  const [newCount, setNewCount] = useState(0);
  const announce = useAnnounce();

  const showNew = async () => {
    const page = await loadNewItems(search, since.current);
    since.current = page.fetchedAt;
    setNewCount(0);
    if (!page.items.length) return;
    heightBeforeInsert.current = document.documentElement.scrollHeight;
    setItems((current) => {
      const seen = new Set(current.map(({ id }) => id));
      return [...page.items.filter(({ id }) => !seen.has(id)), ...current].sort(newestFirst);
    });
    announce(`${page.items.length} new ${page.items.length === 1 ? 'item' : 'items'} added`);
  };

  useLayoutEffect(() => {
    if (heightBeforeInsert.current === null) return;
    const added = document.documentElement.scrollHeight - heightBeforeInsert.current;
    heightBeforeInsert.current = null;
    if (window.scrollY > 0) window.scrollBy(0, added);
  }, [items]);

  useEffect(() => {
    const check = async () => {
      if (document.hidden) return;
      lastCheck.current = Date.now();
      const count = await checkNewItems(search, since.current);
      setNewCount(count);
      if (count) announce(`${count} new ${count === 1 ? 'item' : 'items'} available`);
    };
    const onVisible = () => {
      if (!document.hidden && Date.now() - lastCheck.current >= FOCUS_CHECK_MS) check();
    };
    const onRefreshed = () => showNew();
    window.addEventListener(REFRESHED_EVENT, onRefreshed);
    if (!refreshMinutes) return () => window.removeEventListener(REFRESHED_EVENT, onRefreshed);
    const timer = setInterval(check, refreshMinutes * 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(REFRESHED_EVENT, onRefreshed);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  });

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
      <div className='sticky top-0 z-10 flex justify-center'>
        {newCount > 0 && (
          <button
            type='button'
            onClick={() => startTransition(showNew)}
            className='mt-2 min-h-11 rounded-full bg-accent px-4 text-sm font-semibold text-white shadow-lg hover:bg-accent-hover'
          >
            Show {newCount} new {newCount === 1 ? 'item' : 'items'}
          </button>
        )}
      </div>
      <ul
        className={
          layout === 'cards'
            ? 'grid gap-4 [overflow-anchor:none] sm:grid-cols-2 lg:grid-cols-3'
            : '[overflow-anchor:none]'
        }
      >
        {items.map((item) => (
          <ItemRow key={item.id} item={item} search={search} now={now} layout={layout} />
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
