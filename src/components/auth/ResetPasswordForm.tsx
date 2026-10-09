'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FormError from '@/components/ui/FormError';
import SubmitButton from '@/components/ui/SubmitButton';
import TextField from '@/components/ui/TextField';
import useAuthForm from '@/components/auth/useAuthForm';
import { resetSchema } from '@/lib/accounts/forms';
import authClient from '@/lib/auth-client';

function InvalidLink() {
  return (
    <p role='alert' className='text-text-secondary'>
      This reset link is invalid or has expired.{' '}
      <Link href='/forgot-password' className='text-accent underline'>
        Request a new one
      </Link>
    </p>
  );
}

export default function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const { field, submit, formError, isPending } = useAuthForm(resetSchema, {
    password: '',
    confirm: '',
  });

  const onSubmit = submit(async ({ password }) => {
    if (!token) return null;
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (!error) {
      router.push('/sign-in?reset=1');
      return null;
    }
    return error.code === 'INVALID_TOKEN'
      ? 'This reset link is invalid or has expired. Request a new one.'
      : "We couldn't reset your password. Please try again.";
  });

  if (!token) return <InvalidLink />;

  return (
    <form onSubmit={onSubmit} noValidate className='flex flex-col gap-4'>
      <FormError message={formError} />
      <TextField
        label='New password'
        type='password'
        autoComplete='new-password'
        {...field('password')}
      />
      <TextField
        label='Confirm new password'
        type='password'
        autoComplete='new-password'
        {...field('confirm')}
      />
      <SubmitButton isPending={isPending} label='Set new password' pendingLabel='Saving…' />
    </form>
  );
}
