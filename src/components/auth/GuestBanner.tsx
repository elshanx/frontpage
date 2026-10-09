import Link from 'next/link';

export default function GuestBanner() {
  return (
    <section
      aria-label='Guest mode'
      className='border-b border-border-subtle bg-accent-subtle px-4 py-2 text-center text-sm text-text-secondary'
    >
      You&apos;re exploring as a guest. Your feeds and reading progress are kept for 24 hours —{' '}
      <Link href='/sign-up' className='font-semibold text-accent underline'>
        create a free account
      </Link>{' '}
      to keep them, add your own feeds and sync across devices.
    </section>
  );
}
