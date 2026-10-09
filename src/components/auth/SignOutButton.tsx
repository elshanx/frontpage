'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import authClient from '@/lib/auth-client';

export default function SignOutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const signOut = () =>
    startTransition(async () => {
      await authClient.signOut();
      router.push('/');
      router.refresh();
    });

  return (
    <button
      type='button'
      onClick={signOut}
      disabled={isPending}
      className='min-h-11 rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary disabled:opacity-60'
    >
      {isPending ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
