import Link from 'next/link';
import FeedIcon from '@/components/FeedIcon';
import NavLink from '@/components/NavLink';
import { getNavigation } from '@/lib/items';

type NavFeed = Awaited<ReturnType<typeof getNavigation>>['uncategorized'][number];

function FeedLinks({ feeds, counts }: { feeds: NavFeed[]; counts: Record<string, number> }) {
  return (
    <ul className='ml-3 border-l border-border-subtle pl-2'>
      {feeds.map((feed) => (
        <li key={feed.id}>
          <NavLink
            filter={{ kind: 'feed', id: feed.id, unreadOnly: false }}
            count={counts[feed.id] ?? 0}
          >
            <FeedIcon src={feed.iconUrl} title={feed.title} />
            <span className='truncate'>{feed.title}</span>
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

export default async function Sidebar({ userId }: { userId: string }) {
  const { counts, categories, uncategorized, needAttention } = await getNavigation(userId);
  const groups = [
    ...categories.map(({ id, name, feeds }) => ({
      id,
      name,
      feeds,
      count: counts.byCategory[id] ?? 0,
    })),
    ...(uncategorized.length
      ? [{ id: null, name: 'Uncategorized', feeds: uncategorized, count: counts.uncategorized }]
      : []),
  ].filter(({ feeds }) => feeds.length);

  return (
    <nav aria-label='Feeds' className='flex flex-col gap-4 p-3 text-sm'>
      <NavLink filter={{ kind: 'all', unreadOnly: false }} count={counts.total}>
        All items
      </NavLink>
      {groups.length > 0 && (
        <ul className='flex flex-col gap-3'>
          {groups.map((group) => (
            <li key={group.id ?? 'uncategorized'}>
              <NavLink
                filter={{ kind: 'category', id: group.id, unreadOnly: false }}
                count={group.count}
              >
                <span className='truncate font-medium text-text-primary'>{group.name}</span>
              </NavLink>
              <FeedLinks feeds={group.feeds} counts={counts.byFeed} />
            </li>
          ))}
        </ul>
      )}
      {needAttention > 0 && (
        <Link
          href='/app/feeds'
          className='flex min-h-9 items-center gap-2 rounded-md px-2 text-xs text-warning hover:bg-bg-tertiary'
        >
          <svg aria-hidden='true' viewBox='0 0 16 16' className='size-3.5 fill-current'>
            <path d='M8 1.5 15 14.5H1L8 1.5Zm-.75 5v4h1.5v-4h-1.5Zm0 5.25v1.5h1.5v-1.5h-1.5Z' />
          </svg>
          {needAttention} {needAttention === 1 ? 'feed needs' : 'feeds need'} attention
        </Link>
      )}
      <Link
        href='/app/feeds'
        className='flex min-h-9 items-center rounded-md px-2 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary pointer-coarse:min-h-11'
      >
        Manage feeds
      </Link>
    </nav>
  );
}
