import Link from 'next/link';
import GuestButton from '@/components/auth/GuestButton';
import { getSession } from '@/lib/session';

const FEATURES = [
  {
    title: 'One calm front page',
    body: 'Blogs, newsletters and changelogs, sorted into your own categories. Unread counts that stay honest, and a reader view without the clutter.',
  },
  {
    title: 'A digest, not a firehose',
    body: 'A ranked digest of what’s new since your last visit. Quiet feeds get a fair spot next to loud ones, and one tap marks it all done.',
  },
  {
    title: 'Built for the keyboard',
    body: 'j and k to move, s to save, ⌘K to jump anywhere. Every action works without a mouse, and ? shows the whole list.',
  },
  {
    title: 'Comfortable for every reader',
    body: 'Pick your font, size, spacing and line length. Light, dark and high-contrast themes, and an optional AI summary when an article runs long.',
  },
];

const MOCK_ROWS = [
  {
    feed: 'Vercel Changelog',
    title: 'Faster cold starts for Node.js functions',
    age: '12m',
    unread: true,
  },
  { feed: 'Julia Evans', title: 'Some notes on DNS caching', age: '1h', unread: true },
  { feed: 'Overreacted', title: 'The two Reacts', age: '3h', unread: true },
  {
    feed: 'Simon Willison',
    title: 'Things I learned building with LLM tools',
    age: '5h',
    unread: false,
  },
  { feed: 'CSS-Tricks', title: 'A practical guide to container queries', age: '1d', unread: false },
];

function ProductMock() {
  return (
    <div
      aria-hidden='true'
      className='overflow-hidden rounded-xl border border-border bg-bg-primary text-left shadow-lg'
    >
      <div className='flex items-center gap-1.5 border-b border-border-subtle bg-bg-secondary px-3 py-2'>
        <span className='size-2.5 rounded-full bg-border' />
        <span className='size-2.5 rounded-full bg-border' />
        <span className='size-2.5 rounded-full bg-border' />
      </div>
      <div className='flex'>
        <div className='hidden w-44 shrink-0 flex-col gap-1 border-r border-border-subtle bg-bg-secondary p-3 text-xs sm:flex'>
          {['All items', 'Frontend', 'Backend & DevOps', 'Newsletters'].map((name, index) => (
            <span
              key={name}
              className={`flex justify-between rounded px-2 py-1.5 ${index === 0 ? 'bg-accent-subtle font-semibold text-text-primary' : 'text-text-secondary'}`}
            >
              {name}
              <span className='text-text-tertiary'>{[42, 18, 9, 15][index]}</span>
            </span>
          ))}
        </div>
        <ul className='min-w-0 flex-1 px-4'>
          {MOCK_ROWS.map(({ feed, title, age, unread }) => (
            <li key={title} className='flex gap-3 border-b border-border-subtle py-3 last:border-0'>
              <span
                className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? 'bg-unread' : 'bg-transparent'}`}
              />
              <span className='min-w-0'>
                <span
                  className={`block truncate text-sm ${unread ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}
                >
                  {title}
                </span>
                <span className='text-xs text-text-tertiary'>
                  {feed} · {age}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default async function Home() {
  const session = await getSession();
  return (
    <>
      <main id='main' className='mx-auto max-w-page px-4'>
        <section className='mx-auto max-w-content pt-16 pb-12 text-center md:pt-24'>
          <p className='text-sm font-semibold text-accent'>Frontpage</p>
          <h1 className='mt-3 text-3xl font-bold text-balance md:text-4xl'>
            Your personalized front page for tech content.
          </h1>
          <p className='mt-4 text-lg text-pretty text-text-secondary'>
            Follow the blogs, newsletters and changelogs you care about, in one calm, organized
            place. No algorithm, no ads, no infinite outrage.
          </p>
          <div className='mt-8'>
            {session ? (
              <Link
                href='/app'
                className='inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-semibold text-white hover:bg-accent-hover'
              >
                Open your front page
              </Link>
            ) : (
              <div className='flex flex-col items-center gap-4'>
                <div className='flex flex-wrap items-start justify-center gap-3'>
                  <Link
                    href='/sign-up'
                    className='inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-semibold text-white hover:bg-accent-hover'
                  >
                    Create a free account
                  </Link>
                  <GuestButton />
                </div>
                <p className='text-sm text-text-secondary'>
                  Guest mode needs no email and keeps your feeds for 24 hours. Already have an
                  account?{' '}
                  <Link href='/sign-in' className='font-semibold text-accent underline'>
                    Sign in
                  </Link>
                </p>
              </div>
            )}
          </div>
        </section>
        <figure className='mx-auto max-w-feed'>
          <ProductMock />
          <figcaption className='mt-3 text-center text-sm text-text-tertiary'>
            The main reading view: categories on the left, unread items in bold.
          </figcaption>
        </figure>
        <section aria-labelledby='features' className='mx-auto max-w-feed py-16'>
          <h2 id='features' className='sr-only'>
            Features
          </h2>
          <ul className='grid gap-8 sm:grid-cols-2'>
            {FEATURES.map(({ title, body }) => (
              <li key={title}>
                <h3 className='font-semibold'>{title}</h3>
                <p className='mt-2 text-text-secondary'>{body}</p>
              </li>
            ))}
          </ul>
        </section>
      </main>
      <footer className='border-t border-border-subtle px-4 py-6 text-center text-sm text-text-tertiary'>
        <Link href='/accessibility' className='underline hover:text-text-primary'>
          Accessibility
        </Link>
      </footer>
    </>
  );
}
