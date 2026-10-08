import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import ItemList from '@/components/ItemList';
import ItemListSkeleton from '@/components/ItemListSkeleton';
import MarkAllRead from '@/components/MarkAllRead';
import { ReadStateProvider } from '@/components/ReadState';
import RefreshButton from '@/components/RefreshButton';
import StarterPacks from '@/components/StarterPacks';
import { filterLabel, lastUpdated } from '@/lib/items';
import { getPreferences } from '@/lib/preferences';
import { filterToSearch, parseListFilter } from '@/lib/reading/filters';
import { requireUser } from '@/lib/session';
import { subscriptionCount } from '@/lib/subscriptions';

export const maxDuration = 300;

export async function generateMetadata({ searchParams }: PageProps<'/app'>): Promise<Metadata> {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const filter = parseListFilter(params);
  const label = await filterLabel(user.id, filter);
  return { title: filter.unreadOnly ? `Unread · ${label}` : label };
}

export default async function AppPage({ searchParams }: PageProps<'/app'>) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  if (!(await subscriptionCount(user.id))) {
    return (
      <main id='main' className='mx-auto max-w-feed px-4 py-6'>
        <h1 className='text-xl font-semibold'>Welcome to Frontpage</h1>
        <StarterPacks />
      </main>
    );
  }
  const filter = parseListFilter(params);
  const [label, freshness, { refreshMinutes, layout }] = await Promise.all([
    filterLabel(user.id, filter),
    lastUpdated(user.id, filter),
    getPreferences(user.id),
  ]);
  const search = filterToSearch(filter);
  const views = [
    { name: 'All', unreadOnly: false },
    { name: 'Unread', unreadOnly: true },
  ];

  return (
    <main id='main' className='mx-auto max-w-feed px-4 py-6'>
      <ReadStateProvider key={search}>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <h1 className='text-xl font-semibold'>{label}</h1>
          <div className='flex flex-wrap items-center gap-2'>
            <nav aria-label='Show' className='flex rounded-md border border-border p-0.5 text-sm'>
              {views.map(({ name, unreadOnly }) => (
                <Link
                  key={name}
                  href={`/app${filterToSearch({ ...filter, unreadOnly })}`}
                  aria-current={filter.unreadOnly === unreadOnly ? 'page' : undefined}
                  className='flex min-h-10 items-center rounded px-3 text-text-secondary hover:text-text-primary aria-[current=page]:bg-bg-tertiary aria-[current=page]:font-semibold aria-[current=page]:text-text-primary'
                >
                  {name}
                </Link>
              ))}
            </nav>
            <RefreshButton search={search} {...freshness} />
            <MarkAllRead
              search={search}
              label={filter.kind === 'all' ? 'Mark all read' : `Mark ${label} read`}
            />
          </div>
        </div>
        <Suspense key={search} fallback={<ItemListSkeleton />}>
          <ItemList userId={user.id} filter={filter} refreshMinutes={refreshMinutes} />
        </Suspense>
      </ReadStateProvider>
    </main>
  );
}
