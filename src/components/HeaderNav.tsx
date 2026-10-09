'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/app', label: 'Feed' },
  { href: '/app/digest', label: 'Digest' },
  { href: '/app/feeds', label: 'Feeds' },
];

export default function HeaderNav() {
  const pathname = usePathname();
  const current = pathname === '/app' || pathname.startsWith('/app/item') ? '/app' : pathname;
  return (
    <nav aria-label='Sections' className='flex gap-1 text-sm max-sm:hidden'>
      {LINKS.map(({ href, label }) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? 'page' : undefined}
          className='flex min-h-9 items-center rounded-md px-3 text-text-secondary hover:text-text-primary aria-[current=page]:bg-bg-tertiary aria-[current=page]:font-medium aria-[current=page]:text-text-primary'
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
