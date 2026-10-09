'use client';

import { useState } from 'react';
import FormError from '@/components/ui/FormError';
import SubmitButton from '@/components/ui/SubmitButton';
import TextField from '@/components/ui/TextField';
import useAuthForm from '@/components/auth/useAuthForm';
import { emailSchema } from '@/lib/accounts/forms';
import authClient from '@/lib/auth-client';

export default function ForgotPasswordForm() {
  const [isSent, setIsSent] = useState(false);
  const { field, submit, formError, isPending } = useAuthForm(emailSchema, { email: '' });

  const onSubmit = submit(async ({ email }) => {
    await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' });
    setIsSent(true);
    return null;
  });

  if (isSent) {
    return (
      <p role='status' className='text-text-secondary'>
        If an account exists for that email, we&apos;ve sent a reset link. It expires in 1 hour.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className='flex flex-col gap-4'>
      <FormError message={formError} />
      <TextField label='Email' type='email' autoComplete='email' {...field('email')} />
      <SubmitButton isPending={isPending} label='Send reset link' pendingLabel='Sending…' />
    </form>
  );
}
