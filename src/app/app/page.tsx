import type { Metadata } from 'next';
import { Suspense } from 'react';
import ItemList from '@/components/ItemList';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'All items' };

export default async function AppPage() {
  const user = await requireUser();
  return (
    <main id='main' className='mx-auto max-w-feed px-4 py-8'>
      <h1 className='text-xl font-semibold'>All items</h1>
      <Suspense
        fallback={<p className='py-12 text-center text-text-secondary'>Loading your feeds…</p>}
      >
        <ItemList userId={user.id} />
      </Suspense>
    </main>
  );
}
