import Link from 'next/link';
import GuestButton from '@/components/GuestButton';
import { getSession } from '@/lib/session';

export default async function Home() {
  const session = await getSession();
  return (
    <main id='main' className='grid min-h-dvh place-items-center px-4'>
      <div className='max-w-content text-center'>
        <h1 className='text-2xl font-bold md:text-3xl'>
          Your personalized front page for tech content.
        </h1>
        <p className='mt-4 text-text-secondary'>
          Blogs, newsletters and changelogs in one calm, organized place.
        </p>
        <div className='mt-8'>
          {session ? (
            <Link href='/app' className='font-semibold text-accent underline'>
              Open your front page
            </Link>
          ) : (
            <GuestButton />
          )}
        </div>
      </div>
    </main>
  );
}
