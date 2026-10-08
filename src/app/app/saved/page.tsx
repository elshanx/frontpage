import type { Metadata } from 'next';
import Link from 'next/link';
import ItemRow from '@/components/ItemRow';
import { ReadStateProvider } from '@/components/ReadState';
import { type SavedSort, listSaved } from '@/lib/items';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Saved' };

const SORTS: { value: SavedSort; label: string }[] = [
  { value: 'saved', label: 'Date saved' },
  { value: 'published', label: 'Date published' },
];

export default async function SavedPage({ searchParams }: PageProps<'/app/saved'>) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const sort: SavedSort = params.sort === 'published' ? 'published' : 'saved';
  const q = typeof params.q === 'string' ? params.q.trim().slice(0, 200) : '';
  const { items, fetchedAt: now } = await listSaved(user.id, sort, q);
  const href = (next: SavedSort) =>
    `/app/saved?${new URLSearchParams({ sort: next, ...(q ? { q } : {}) })}`;

  return (
    <main id='main' className='mx-auto max-w-feed px-4 py-6'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-xl font-semibold'>Saved</h1>
        <nav aria-label='Sort by' className='flex rounded-md border border-border p-0.5 text-sm'>
          {SORTS.map(({ value, label }) => (
            <Link
              key={value}
              href={href(value)}
              aria-current={sort === value ? 'page' : undefined}
              className='flex min-h-10 items-center rounded px-3 text-text-secondary hover:text-text-primary aria-[current=page]:bg-bg-tertiary aria-[current=page]:font-semibold aria-[current=page]:text-text-primary'
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <form role='search' className='mt-4 flex gap-2'>
        <input type='hidden' name='sort' value={sort} />
        <label htmlFor='saved-q' className='flex min-w-0 flex-1'>
          <span className='sr-only'>Search saved items</span>
          <input
            id='saved-q'
            name='q'
            type='search'
            defaultValue={q}
            placeholder='Search saved items'
            className='min-h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-base'
          />
        </label>
        <button
          type='submit'
          className='min-h-11 rounded-md border border-border px-4 text-sm font-semibold hover:bg-bg-tertiary'
        >
          Search
        </button>
      </form>
      <p aria-live='polite' className='mt-4 text-sm text-text-secondary'>
        {items.length} {items.length === 1 ? 'item' : 'items'}
        {q && ` matching “${q}”`}
      </p>
      {items.length ? (
        <ReadStateProvider>
          <ul>
            {items.map((item) => (
              <ItemRow key={item.id} item={item} search='' now={now} />
            ))}
          </ul>
        </ReadStateProvider>
      ) : (
        <p className='py-12 text-center text-text-secondary'>
          {q
            ? 'No saved items match. Try fewer or different words.'
            : 'Nothing saved yet. Use the bookmark button on any item to keep it here.'}
        </p>
      )}
    </main>
  );
}
