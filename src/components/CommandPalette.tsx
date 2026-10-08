'use client';

import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { refreshAction, setLayoutAction } from '@/app/app/actions';
import { useAnnounce } from '@/components/Announcer';
import { REFRESHED_EVENT } from '@/components/RefreshButton';
import { filterToSearch } from '@/lib/reading/filters';
import { LAYOUTS } from '@/lib/reading/layout';

interface Destination {
  id: string | null;
  name: string;
}

const PAGES = [
  { href: '/app', name: 'All items' },
  { href: '/app/saved', name: 'Saved' },
  { href: '/app/digest', name: 'Digest' },
  { href: '/app/search', name: 'Search' },
  { href: '/app/feeds', name: 'Manage feeds' },
  { href: '/app/settings', name: 'Settings' },
];

const itemClass =
  'flex min-h-11 cursor-pointer items-center rounded-md px-3 text-sm data-[selected=true]:bg-accent-subtle data-[selected=true]:text-text-primary';
const groupClass =
  '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-tertiary';

export default function CommandPalette({
  categories,
  feeds,
}: {
  categories: Destination[];
  feeds: Destination[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const announce = useAnnounce();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const run = (action: () => unknown) => {
    setOpen(false);
    action();
  };

  const refreshAll = async () => {
    announce('Refreshing all feeds…');
    const { feeds: refreshed, newItems } = await refreshAction('');
    announce(`Refreshed ${refreshed} feeds · ${newItems} new items`);
    if (newItems) window.dispatchEvent(new Event(REFRESHED_EVENT));
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label='Command palette'
      overlayClassName='fixed inset-0 z-40 bg-black/50'
      contentClassName='fixed inset-x-4 top-[15vh] z-50 mx-auto max-w-lg overflow-hidden rounded-lg border border-border bg-surface text-text-primary shadow-lg'
    >
      <Command.Input
        placeholder='Go to a feed, category or page…'
        className='min-h-12 w-full border-b border-border bg-transparent px-4 text-base outline-none'
      />
      <Command.List className='max-h-[60vh] overflow-y-auto p-2'>
        <Command.Empty className='px-3 py-6 text-center text-sm text-text-secondary'>
          No matches.
        </Command.Empty>
        <Command.Group heading='Actions' className={groupClass}>
          <Command.Item className={itemClass} onSelect={() => run(refreshAll)}>
            Refresh all feeds
          </Command.Item>
          {LAYOUTS.map((layout) => (
            <Command.Item
              key={layout}
              className={itemClass}
              onSelect={() => run(() => setLayoutAction(layout))}
            >
              Switch to {layout} layout
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading='Pages' className={groupClass}>
          {PAGES.map(({ href, name }) => (
            <Command.Item
              key={href}
              className={itemClass}
              onSelect={() => run(() => router.push(href))}
            >
              {name}
            </Command.Item>
          ))}
        </Command.Group>
        {categories.length > 0 && (
          <Command.Group heading='Categories' className={groupClass}>
            {categories.map(({ id, name }) => (
              <Command.Item
                key={id ?? 'uncategorized'}
                value={`category ${name}`}
                className={itemClass}
                onSelect={() =>
                  run(() =>
                    router.push(
                      `/app${filterToSearch({ kind: 'category', id, unreadOnly: false })}`
                    )
                  )
                }
              >
                {name}
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {feeds.length > 0 && (
          <Command.Group heading='Feeds' className={groupClass}>
            {feeds.map(({ id, name }) => (
              <Command.Item
                key={id}
                value={`feed ${name} ${id}`}
                className={itemClass}
                onSelect={() => run(() => router.push(`/app?feed=${id}`))}
              >
                {name}
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
