'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { badgeCount } from '@/lib/reading/format';
import { type ListFilter, filterToSearch, parseListFilter } from '@/lib/reading/filters';

const scopeKey = (filter: ListFilter) => filterToSearch({ ...filter, unreadOnly: false });

export default function NavLink({
  filter,
  count,
  children,
}: {
  filter: ListFilter;
  count: number;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const current = parseListFilter(Object.fromEntries(useSearchParams()));
  const isCurrent = pathname === '/app' && scopeKey(current) === scopeKey(filter);
  const badge = badgeCount(count);

  return (
    <Link
      href={`/app${filterToSearch({ ...filter, unreadOnly: current.unreadOnly })}`}
      aria-current={isCurrent ? 'page' : undefined}
      className='flex min-h-9 items-center gap-2 rounded-md px-2 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary aria-[current=page]:bg-accent-subtle aria-[current=page]:font-semibold aria-[current=page]:text-text-primary pointer-coarse:min-h-11'
    >
      {children}
      {badge && (
        <span className='ml-auto text-xs text-text-tertiary tabular-nums'>
          {badge}
          <span className='sr-only'> unread</span>
        </span>
      )}
    </Link>
  );
}
