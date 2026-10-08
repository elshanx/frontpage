import Link from 'next/link';

const linkClass =
  'flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-bg-tertiary hover:text-text-primary';

export default function ReaderNav({
  from,
  newerId,
  olderId,
  label,
}: {
  from: string;
  newerId: string | null;
  olderId: string | null;
  label: string;
}) {
  return (
    <nav aria-label={label} className='flex flex-wrap items-center justify-between gap-2'>
      <Link href={`/app${from}`} data-shortcut='u' className={linkClass}>
        <span aria-hidden='true'>←&nbsp;</span>Back to list
      </Link>
      <div className='flex gap-1'>
        {newerId && (
          <Link href={`/app/item/${newerId}${from}`} data-shortcut='k' className={linkClass}>
            Newer
          </Link>
        )}
        {olderId && (
          <Link href={`/app/item/${olderId}${from}`} data-shortcut='j' className={linkClass}>
            Older
          </Link>
        )}
      </div>
    </nav>
  );
}
