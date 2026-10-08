import type { Metadata } from 'next';
import Link from 'next/link';
import DigestDone from '@/components/DigestDone';
import ItemRow from '@/components/ItemRow';
import { ReadStateProvider } from '@/components/ReadState';
import rankDigest, { type DigestWindow, digestWindowStart } from '@/lib/digest/rank';
import prisma from '@/lib/db';
import { listDigestItems, weeklyCounts } from '@/lib/items';
import { getPreferences } from '@/lib/preferences';
import { filterToSearch } from '@/lib/reading/filters';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Digest' };

const WINDOWS: { value: DigestWindow; label: string }[] = [
  { value: 'since', label: 'Since last visit' },
  { value: 'day', label: 'Last 24 hours' },
  { value: 'week', label: 'Last week' },
];

export default async function DigestPage({ searchParams }: PageProps<'/app/digest'>) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const window = WINDOWS.find(({ value }) => value === params.window)?.value ?? 'since';
  const now = new Date();
  const { digestSeenAt, layout } = await getPreferences(user.id);
  const [items, counts, categories] = await Promise.all([
    listDigestItems(user.id, digestWindowStart(window, digestSeenAt, now)),
    weeklyCounts(user.id, now),
    prisma.category.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ]);
  const digest = rankDigest(
    items.map((item) => ({ ...item, publishedAt: new Date(item.publishedAt) })),
    counts,
    now
  );
  const names = new Map(categories.map(({ id, name }) => [id, name]));
  const shown = digest.kind === 'quiet' ? digest.items : digest.groups.flatMap((g) => g.items);
  const row = (item: (typeof shown)[number]) => (
    <ItemRow
      key={item.id}
      item={item}
      search=''
      now={now.getTime()}
      layout={layout === 'cards' ? 'comfortable' : layout}
    />
  );

  return (
    <main id='main' className='mx-auto max-w-feed px-4 py-6'>
      <h1 className='text-xl font-semibold'>Digest</h1>
      <nav aria-label='Digest window' className='mt-4 flex flex-wrap gap-1 text-sm'>
        {WINDOWS.map(({ value, label }) => (
          <Link
            key={value}
            href={`/app/digest?window=${value}`}
            aria-current={value === window ? 'page' : undefined}
            className='flex min-h-10 items-center rounded-md border border-border px-3 text-text-secondary hover:text-text-primary aria-[current=page]:bg-bg-tertiary aria-[current=page]:font-semibold aria-[current=page]:text-text-primary'
          >
            {label}
          </Link>
        ))}
      </nav>
      <ReadStateProvider key={window}>
        {digest.kind === 'quiet' ? (
          <section aria-labelledby='quiet' className='mt-6'>
            <h2 id='quiet' className='font-semibold'>
              {shown.length ? 'A quiet stretch — here is everything' : "That's everything"}
            </h2>
            {shown.length > 0 && <ul>{shown.map(row)}</ul>}
          </section>
        ) : (
          digest.groups.map(({ categoryId, items: groupItems, more }) => {
            const name = categoryId ? (names.get(categoryId) ?? 'Unknown') : 'Uncategorized';
            return (
              <section key={categoryId ?? 'none'} aria-label={name} className='mt-6'>
                <h2 className='font-semibold'>{name}</h2>
                <ul>{groupItems.map(row)}</ul>
                {more > 0 && (
                  <Link
                    href={`/app${filterToSearch({ kind: 'category', id: categoryId, unreadOnly: true })}`}
                    className='mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-accent underline'
                  >
                    {more} more in {name}
                  </Link>
                )}
              </section>
            );
          })
        )}
        {shown.length > 0 && (
          <div className='mt-8 flex justify-center'>
            <DigestDone itemIds={shown.map(({ id }) => id)} />
          </div>
        )}
      </ReadStateProvider>
    </main>
  );
}
