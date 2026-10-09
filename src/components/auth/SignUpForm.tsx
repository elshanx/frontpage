'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import FormError from '@/components/ui/FormError';
import SubmitButton from '@/components/ui/SubmitButton';
import TextField from '@/components/ui/TextField';
import useAuthForm from '@/components/auth/useAuthForm';
import { safeNextPath, signUpSchema } from '@/lib/accounts/forms';
import authClient from '@/lib/auth-client';

export default function SignUpForm({ next }: { next: string }) {
  const router = useRouter();
  const { field, submit, formError, isPending } = useAuthForm(signUpSchema, {
    name: '',
    email: '',
    password: '',
  });

  const onSubmit = submit(async (data) => {
    const { error } = await authClient.signUp.email(data);
    if (!error) {
      router.push(safeNextPath(next));
      router.refresh();
      return null;
    }
    if (error.code?.startsWith('USER_ALREADY_EXISTS')) {
      return 'An account with this email already exists. Sign in instead?';
    }
    if (error.status === 429) return 'Too many attempts. Try again in a minute.';
    return "We couldn't create your account. Please try again.";
  });

  return (
    <form onSubmit={onSubmit} noValidate className='flex flex-col gap-4'>
      <FormError message={formError} />
      <TextField label='Name' autoComplete='name' {...field('name')} />
      <TextField label='Email' type='email' autoComplete='email' {...field('email')} />
      <TextField
        label='Password'
        type='password'
        autoComplete='new-password'
        {...field('password')}
      />
      <SubmitButton isPending={isPending} label='Create account' pendingLabel='Creating account…' />
      <p className='text-sm text-text-secondary'>
        Already have an account?{' '}
        <Link href={`/sign-in?next=${encodeURIComponent(next)}`} className='text-accent underline'>
          Sign in
        </Link>
      </p>
    </form>
  );
}
