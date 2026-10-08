'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import authClient from '@/lib/auth-client';

export default function GuestButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const tryAsGuest = () =>
    startTransition(async () => {
      setError(null);
      const { error: signInError } = await authClient.signIn.anonymous();
      if (signInError) {
        setError("We couldn't start a guest session. Please try again.");
        return;
      }
      router.push('/app');
    });

  return (
    <div className='flex flex-col items-center gap-2'>
      <button
        type='button'
        onClick={tryAsGuest}
        disabled={isPending}
        className='min-h-11 rounded-md bg-accent px-5 font-semibold text-white hover:bg-accent-hover disabled:opacity-60'
      >
        {isPending ? 'Setting up your front page…' : 'Try as guest'}
      </button>
      {error && (
        <p role='alert' className='text-sm text-error'>
          {error}
        </p>
      )}
    </div>
  );
}
