import type { Metadata } from 'next';
import SignInForm from '@/components/SignInForm';
import { safeNextPath } from '@/lib/accounts/forms';
import { redirectSignedIn } from '@/lib/session';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  await redirectSignedIn();
  const { next, reset } = await searchParams;
  return (
    <>
      <h1 className='mb-4 text-xl font-semibold'>Sign in</h1>
      {reset === '1' && (
        <p role='status' className='mb-4 text-sm text-success'>
          Password updated — sign in with your new password.
        </p>
      )}
      <SignInForm next={safeNextPath(typeof next === 'string' ? next : null)} />
    </>
  );
}
