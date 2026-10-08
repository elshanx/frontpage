import type { Metadata } from 'next';
import AddFeedForm from '@/components/AddFeedForm';
import FeedRow from '@/components/FeedRow';
import HealthBadge from '@/components/HealthBadge';
import type { FeedHealth } from '@/lib/feeds/health';
import summarizeHealth from '@/lib/manage/health';
import { requireUser } from '@/lib/session';
import { listManagedFeeds } from '@/lib/subscriptions';

export const metadata: Metadata = { title: 'Manage feeds' };

const SUMMARY_ORDER: FeedHealth[] = ['active', 'stale', 'error', 'dead', 'pending'];

export default async function FeedsPage() {
  const user = await requireUser();
  const { categories, uncategorized, feeds } = await listManagedFeeds(user.id);
  const now = new Date();
  const summary = summarizeHealth(
    feeds.map(({ healthInput }) => healthInput),
    now
  );
  const options = categories.map(({ id, name }) => ({ id, name }));
  const groups = [
    ...categories,
    ...(uncategorized.length ? [{ id: null, name: 'Uncategorized', feeds: uncategorized }] : []),
  ].filter((group) => group.feeds.length);

  return (
    <main id='main' className='mx-auto flex max-w-feed flex-col gap-10 px-4 py-6'>
      <h1 className='text-xl font-semibold'>Manage feeds</h1>

      <section aria-labelledby='health-heading'>
        <h2 id='health-heading' className='text-lg font-semibold'>
          Feed health
        </h2>
        <p className='mt-2 flex flex-wrap gap-x-4 gap-y-1'>
          {SUMMARY_ORDER.filter((health) => summary[health] > 0 || health !== 'pending').map(
            (health) => (
              <HealthBadge key={health} health={health} count={summary[health]} />
            )
          )}
        </p>
      </section>

      <section id='add' aria-labelledby='add-heading' className='scroll-mt-6'>
        <h2 id='add-heading' className='mb-3 text-lg font-semibold'>
          Add a feed
        </h2>
        <AddFeedForm categories={options} />
      </section>

      <section aria-labelledby='feeds-heading'>
        <h2 id='feeds-heading' className='text-lg font-semibold'>
          Your feeds ({feeds.length})
        </h2>
        {groups.length === 0 && (
          <p className='mt-2 text-sm text-text-secondary'>You don&apos;t follow any feeds yet.</p>
        )}
        {groups.map((group) => (
          <div key={group.id ?? 'uncategorized'} className='mt-4'>
            <h3 className='text-sm font-semibold tracking-wide text-text-secondary uppercase'>
              {group.name}
            </h3>
            <ul>
              {group.feeds.map((feed) => (
                <FeedRow key={feed.id} feed={feed} categories={options} now={now} />
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  );
}
