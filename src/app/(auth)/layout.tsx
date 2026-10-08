import Link from 'next/link';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <main id='main' className='grid min-h-dvh place-items-center bg-bg-secondary px-4 py-12'>
      <div className='w-full max-w-sm'>
        <Link href='/' className='mb-6 block text-center text-lg font-bold'>
          Frontpage
        </Link>
        <div className='rounded-lg border border-border bg-surface p-6 shadow-sm'>{children}</div>
      </div>
    </main>
  );
}
