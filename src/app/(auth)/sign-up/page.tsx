import type { Metadata } from 'next';
import SignUpForm from '@/components/SignUpForm';
import { safeNextPath } from '@/lib/accounts/forms';
import { redirectSignedIn } from '@/lib/session';

export const metadata: Metadata = { title: 'Create your account' };

export default async function SignUpPage({ searchParams }: PageProps<'/sign-up'>) {
  const session = await redirectSignedIn();
  const { next } = await searchParams;
  return (
    <>
      <h1 className='text-xl font-semibold'>Create your account</h1>
      <p className='mt-1 mb-4 text-sm text-text-secondary'>
        {session?.user.isAnonymous
          ? 'Your 19 feeds and categories come with you.'
          : 'Save your feeds, categories and reading progress across devices.'}
      </p>
      <SignUpForm next={safeNextPath(typeof next === 'string' ? next : null)} />
    </>
  );
}
