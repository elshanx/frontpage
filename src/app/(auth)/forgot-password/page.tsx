import type { Metadata } from 'next';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';
import { redirectSignedIn } from '@/lib/session';

export const metadata: Metadata = { title: 'Forgot password' };

export default async function ForgotPasswordPage() {
  await redirectSignedIn();
  return (
    <>
      <h1 className='text-xl font-semibold'>Forgot password</h1>
      <p className='mt-1 mb-4 text-sm text-text-secondary'>
        Enter your email and we&apos;ll send you a link to set a new password.
      </p>
      <ForgotPasswordForm />
    </>
  );
}
