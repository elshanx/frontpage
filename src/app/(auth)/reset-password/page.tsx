import type { Metadata } from 'next';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = { title: 'Reset password' };

export default async function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  const { token, error } = await searchParams;
  const validToken = typeof token === 'string' && !error ? token : null;
  return (
    <>
      <h1 className='mb-4 text-xl font-semibold'>Reset password</h1>
      <ResetPasswordForm token={validToken} />
    </>
  );
}
