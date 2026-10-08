import Link from 'next/link';
import GuestBanner from '@/components/GuestBanner';
import SignOutButton from '@/components/SignOutButton';
import { requireUser } from '@/lib/session';

export default async function AppLayout({ children }: LayoutProps<'/app'>) {
  const user = await requireUser();
  return (
    <>
      {user.isAnonymous && <GuestBanner />}
      <header className='border-b border-border-subtle'>
        <div className='mx-auto flex max-w-feed items-center justify-between gap-4 px-4 py-2'>
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
      {children}
    </>
  );
}
