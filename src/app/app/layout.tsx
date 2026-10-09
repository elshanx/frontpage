import Link from 'next/link';
import { Announcer } from '@/components/Announcer';
import CommandPalette from '@/components/CommandPalette';
import GuestBanner from '@/components/auth/GuestBanner';
import HeaderNav from '@/components/HeaderNav';
import Shortcuts from '@/components/Shortcuts';
import Sidebar from '@/components/sidebar/Sidebar';
import SidebarShell from '@/components/sidebar/SidebarShell';
import SignOutButton from '@/components/auth/SignOutButton';
import { getNavigation } from '@/lib/items';
import { getPreferences } from '@/lib/preferences';
import { requireUser } from '@/lib/session';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('') || '?';

export default async function AppLayout({ children }: LayoutProps<'/app'>) {
  const user = await requireUser();
  const [{ reduceMotion }, { categories, uncategorized }] = await Promise.all([
    getPreferences(user.id),
    getNavigation(user.id),
  ]);
  const feeds = [...categories.flatMap((category) => category.feeds), ...uncategorized];
  return (
    <div data-reduce-motion={reduceMotion || undefined}>
      <Announcer>
        <Shortcuts />
        <CommandPalette
          categories={[
            ...categories.map(({ id, name }) => ({ id, name })),
            ...(uncategorized.length ? [{ id: null, name: 'Uncategorized' }] : []),
          ]}
          feeds={feeds.map(({ id, title }) => ({ id, name: title }))}
        />
        {user.isAnonymous && <GuestBanner />}
        <header className='border-b border-border-subtle'>
          <div className='flex items-center gap-4 px-4 py-2'>
            <Link href='/app' className='flex items-center gap-2 text-lg font-bold'>
              <svg aria-hidden='true' viewBox='0 0 32 32' className='size-7'>
                <rect width='32' height='32' rx='7' fill='#2563eb' />
                <g fill='none' stroke='#fff' strokeWidth='2.6' strokeLinecap='round'>
                  <path d='M9 7h14' opacity='.6' />
                  <path d='M9 15.5a8 8 0 0 1 8 8' />
                  <path d='M9 10.5a13 13 0 0 1 13 13' />
                </g>
                <circle cx='10.5' cy='22' r='2.2' fill='#fff' />
              </svg>
              Frontpage
            </Link>
            <HeaderNav />
            <form action='/app/search' role='search' className='ml-auto max-md:hidden'>
              <div className='flex h-9 w-64 items-center gap-2 rounded-md border border-border bg-bg-secondary px-3 text-sm text-text-tertiary focus-within:outline-2 focus-within:outline-accent'>
                <input
                  id='header-search'
                  aria-label='Search articles'
                  type='search'
                  name='q'
                  placeholder='Search articles…'
                  className='min-w-0 flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-tertiary'
                />
                <kbd
                  aria-hidden='true'
                  className='rounded border border-border px-1.5 font-mono text-xs'
                >
                  /
                </kbd>
              </div>
            </form>
            <Link
              href='/app/feeds'
              title='Add feed'
              className='grid size-9 place-items-center rounded-md border border-border text-lg text-text-secondary hover:bg-bg-tertiary hover:text-text-primary max-md:ml-auto'
            >
              <span aria-hidden='true'>+</span>
              <span className='sr-only'>Add feed</span>
            </Link>
            {user.isAnonymous ? (
              <Link
                href='/sign-up'
                className='min-h-11 content-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover'
              >
                Create account
              </Link>
            ) : (
              <div className='flex items-center gap-1'>
                <span
                  title={user.name}
                  className='grid size-9 place-items-center rounded-full bg-accent text-xs font-semibold text-white uppercase'
                >
                  <span aria-hidden='true'>{initials(user.name)}</span>
                  <span className='sr-only'>Signed in as {user.name}</span>
                </span>
                <SignOutButton />
              </div>
            )}
          </div>
        </header>
        <div className='lg:flex'>
          <SidebarShell>
            <Sidebar userId={user.id} />
          </SidebarShell>
          <div className='min-w-0 flex-1'>
            {children}
            <footer className='px-4 py-6 text-center text-sm text-text-tertiary'>
              <Link href='/accessibility' className='underline hover:text-text-primary'>
                Accessibility
              </Link>
              <span aria-hidden='true'> · </span>Press <kbd className='font-mono'>?</kbd> for
              keyboard shortcuts
            </footer>
          </div>
        </div>
      </Announcer>
    </div>
  );
}
