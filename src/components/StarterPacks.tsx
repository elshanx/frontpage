import Link from 'next/link';
import { subscribeStarterPackAction } from '@/app/app/feeds/actions';
import { starterPacks } from '@/lib/subscriptions';

export default function StarterPacks() {
  return (
    <section aria-labelledby='starter-heading' className='py-8'>
      <h2 id='starter-heading' className='text-lg font-semibold'>
        Start with a few feeds
      </h2>
      <p className='mt-1 text-text-secondary'>
        Pick a starter pack, or{' '}
        <Link href='/app/feeds#add' className='font-semibold text-accent underline'>
          add a feed by URL
        </Link>
        .
      </p>
      <ul className='mt-6 grid gap-4 sm:grid-cols-2'>
        {starterPacks.map(({ name, feedTitles }) => (
          <li
            key={name}
            className='flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-secondary p-4'
          >
            <div>
              <h3 className='font-semibold'>{name}</h3>
              <p className='mt-1 text-sm text-text-secondary'>
                {feedTitles.length} feeds: {feedTitles.slice(0, 3).join(', ')}
                {feedTitles.length > 3 ? ' and more' : ''}
              </p>
            </div>
            <form action={subscribeStarterPackAction} className='mt-auto'>
              <input type='hidden' name='name' value={name} />
              <button
                type='submit'
                className='min-h-11 rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover'
              >
                Add {name} pack
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
