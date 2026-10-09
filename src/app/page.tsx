import Link from 'next/link';
import GuestButton from '@/components/auth/GuestButton';
import Decorations from '@/components/landing/Decorations';
import {
  DigestIllustration,
  FrontPageIllustration,
  KeyboardIllustration,
  ReaderIllustration,
} from '@/components/landing/Illustrations';
import LiveMock from '@/components/landing/LiveMock';
import { getSession } from '@/lib/session';

const FEATURES = [
  {
    title: 'One calm front page',
    illustration: <FrontPageIllustration />,
    body: 'Blogs, newsletters and changelogs, sorted into your own categories. Unread counts that stay honest, and a reader view without the clutter.',
  },
  {
    title: 'A digest, not a firehose',
    illustration: <DigestIllustration />,
    body: 'A ranked digest of what’s new since your last visit. Quiet feeds get a fair spot next to loud ones, and one tap marks it all done.',
  },
  {
    title: 'Built for the keyboard',
    illustration: <KeyboardIllustration />,
    body: 'j and k to move, s to save, ⌘K to jump anywhere. Every action works without a mouse, and ? shows the whole list.',
  },
  {
    title: 'Comfortable for every reader',
    illustration: <ReaderIllustration />,
    body: 'Pick your font, size, spacing and line length. Light, dark and high-contrast themes, and an optional AI summary when an article runs long.',
  },
];

export default async function Home() {
  const session = await getSession();
  return (
    <div className='relative isolate'>
      <div
        aria-hidden='true'
        className='pointer-events-none absolute inset-x-0 top-0 -z-10 h-[80rem] bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,color-mix(in_oklab,var(--color-accent)_35%,transparent),transparent),radial-gradient(ellipse_40%_28%_at_85%_22%,color-mix(in_oklab,var(--color-accent)_20%,transparent),transparent),radial-gradient(ellipse_40%_28%_at_15%_35%,color-mix(in_oklab,var(--color-success)_8%,transparent),transparent),radial-gradient(ellipse_50%_35%_at_15%_70%,color-mix(in_oklab,var(--color-accent)_14%,transparent),transparent)]'
      />
      <main id='main' className='relative mx-auto max-w-page px-4'>
        <Decorations />
        <section className='mx-auto max-w-content pt-16 pb-12 text-center md:pt-24'>
          <p className='animate-rise text-sm font-semibold text-accent'>Frontpage</p>
          <h1 className='mt-3 animate-rise bg-linear-to-br from-text-primary to-accent bg-clip-text text-3xl font-bold text-balance text-transparent [animation-delay:80ms] md:text-4xl'>
            Your personalized front page for tech content.
          </h1>
          <p className='mt-4 animate-rise text-lg text-pretty text-text-secondary [animation-delay:160ms]'>
            Follow the blogs, newsletters and changelogs you care about, in one calm, organized
            place. No algorithm, no ads, no infinite outrage.
          </p>
          <div className='mt-8 animate-rise [animation-delay:240ms]'>
            {session ? (
              <Link
                href='/app'
                className='inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-semibold text-white shadow-[0_0_24px] shadow-accent/40 transition hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-accent/60'
              >
                Open your front page
              </Link>
            ) : (
              <div className='flex flex-col items-center gap-4'>
                <div className='flex flex-wrap items-start justify-center gap-3'>
                  <Link
                    href='/sign-up'
                    className='inline-flex min-h-11 items-center rounded-md bg-accent px-5 font-semibold text-white shadow-[0_0_24px] shadow-accent/40 transition hover:-translate-y-0.5 hover:bg-accent-hover hover:shadow-accent/60'
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
        <figure className='relative mx-auto max-w-feed animate-settle'>
          <div
            aria-hidden='true'
            className='absolute -inset-x-8 -inset-y-10 -z-10 rounded-[3rem] bg-accent/12 blur-3xl'
          />
          <LiveMock />
          <figcaption className='mt-3 text-center text-sm text-text-tertiary'>
            The main reading view: categories on the left, unread items in bold.
          </figcaption>
        </figure>
        <section aria-labelledby='features' className='mx-auto max-w-feed py-16'>
          <h2 id='features' className='sr-only'>
            Features
          </h2>
          <ul className='grid gap-4 sm:grid-cols-2'>
            {FEATURES.map(({ title, body, illustration }) => (
              <li
                key={title}
                className='reveal-on-scroll rounded-xl border border-border-subtle bg-bg-secondary p-6 transition duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-lg'
              >
                <div className='mb-5 rounded-lg bg-accent-subtle/60 p-3'>{illustration}</div>
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
    </div>
  );
}
