import Link from 'next/link';
import { Announcer } from '@/components/Announcer';
import GuestBanner from '@/components/GuestBanner';
import Sidebar from '@/components/Sidebar';
import SidebarShell from '@/components/SidebarShell';
import SignOutButton from '@/components/SignOutButton';
import { getPreferences } from '@/lib/preferences';
import { requireUser } from '@/lib/session';

export default async function AppLayout({ children }: LayoutProps<'/app'>) {
  const user = await requireUser();
  const { reduceMotion } = await getPreferences(user.id);
  return (
    <div data-reduce-motion={reduceMotion || undefined}>
      <Announcer>
        {user.isAnonymous && <GuestBanner />}
        <header className='border-b border-border-subtle'>
          <div className='flex items-center justify-between gap-4 px-4 py-2'>
            <Link href='/app' className='text-lg font-bold'>
              Frontpage
            </Link>
            {user.isAnonymous ? (
              <Link
                href='/sign-up'
                className='min-h-11 content-center rounded-md bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover'
              >
                Create account
              </Link>
            ) : (
              <div className='flex items-center gap-2'>
                <span className='text-sm text-text-secondary'>{user.name}</span>
                <SignOutButton />
              </div>
            )}
          </div>
        </header>
        <div className='lg:flex'>
          <SidebarShell>
            <Sidebar userId={user.id} />
          </SidebarShell>
          <div className='min-w-0 flex-1'>{children}</div>
        </div>
      </Announcer>
    </div>
  );
}
