'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FormError from '@/components/ui/FormError';
import SubmitButton from '@/components/ui/SubmitButton';
import TextField from '@/components/ui/TextField';
import useAuthForm from '@/components/auth/useAuthForm';
import { safeNextPath, signInSchema } from '@/lib/accounts/forms';
import authClient from '@/lib/auth-client';

export default function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const { field, submit, formError, isPending } = useAuthForm(signInSchema, {
    email: '',
    password: '',
  });

  const onSubmit = submit(async (data) => {
    const { error } = await authClient.signIn.email(data);
    if (!error) {
      router.push(safeNextPath(next));
      router.refresh();
      return null;
    }
    if (error.status === 429) return 'Too many attempts. Try again in a minute.';
    return 'Email or password is incorrect.';
  });

  return (
    <form onSubmit={onSubmit} noValidate className='flex flex-col gap-4'>
      <FormError message={formError} />
      <TextField label='Email' type='email' autoComplete='email' {...field('email')} />
      <TextField
        label='Password'
        type='password'
        autoComplete='current-password'
        {...field('password')}
      />
      <SubmitButton isPending={isPending} label='Sign in' pendingLabel='Signing in…' />
      <div className='flex flex-wrap justify-between gap-2 text-sm'>
        <Link href='/forgot-password' className='text-accent underline'>
          Forgot password?
        </Link>
        <Link href={`/sign-up?next=${encodeURIComponent(next)}`} className='text-accent underline'>
          Create an account
        </Link>
      </div>
    </form>
  );
}
