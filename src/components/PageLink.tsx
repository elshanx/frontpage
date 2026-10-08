'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { badgeCount } from '@/lib/reading/format';

export default function PageLink({
  href,
  count = 0,
  countLabel = '',
  children,
}: {
  href: string;
  count?: number;
  countLabel?: string;
  children: ReactNode;
}) {
  const badge = badgeCount(count);
  return (
    <Link
      href={href}
      aria-current={usePathname() === href ? 'page' : undefined}
      className='flex min-h-9 items-center gap-2 rounded-md px-2 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary aria-[current=page]:bg-accent-subtle aria-[current=page]:font-semibold aria-[current=page]:text-text-primary pointer-coarse:min-h-11'
    >
      {children}
      {badge && (
        <span className='ml-auto text-xs text-text-tertiary tabular-nums'>
          {badge}
          <span className='sr-only'> {countLabel}</span>
        </span>
      )}
    </Link>
  );
}
