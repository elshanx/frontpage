import Link from 'next/link';
import FeedIcon from '@/components/feeds/FeedIcon';
import CategoryGroup from '@/components/sidebar/CategoryGroup';
import NavLink from '@/components/ui/NavLink';
import PageLink from '@/components/ui/PageLink';
import { getNavigation } from '@/lib/items';
import { categoryColor } from '@/lib/reading/format';

const navIcon = 'size-4 shrink-0 fill-none stroke-current stroke-[1.5]';

type NavFeed = Awaited<ReturnType<typeof getNavigation>>['uncategorized'][number];

function FeedLinks({ feeds, counts }: { feeds: NavFeed[]; counts: Record<string, number> }) {
  return (
    <ul className='ml-9 border-l border-border-subtle pl-2'>
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
  const { counts, saved, categories, uncategorized, needAttention } = await getNavigation(userId);
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
    <>
      <nav
        aria-label='Categories'
        className='hidden flex-col items-center gap-1 p-2 text-sm group-data-collapsed:flex'
      >
        {groups.map((group) => (
          <NavLink
            key={group.id ?? 'uncategorized'}
            filter={{ kind: 'category', id: group.id, unreadOnly: false }}
            count={0}
          >
            <span
              aria-hidden='true'
              title={group.name}
              className='grid size-6 place-items-center rounded-sm text-xs font-semibold text-white'
              style={{ backgroundColor: categoryColor(group.name) }}
            >
              {group.name.charAt(0).toUpperCase()}
            </span>
            <span className='sr-only'>{group.name}</span>
          </NavLink>
        ))}
      </nav>
      <nav
        aria-label='Feeds'
        className='flex flex-col gap-4 p-3 text-sm group-data-collapsed:hidden'
      >
        <NavLink filter={{ kind: 'all', unreadOnly: false }} count={counts.total}>
          <svg aria-hidden='true' viewBox='0 0 16 16' className={navIcon}>
            <rect x='2.25' y='2.25' width='11.5' height='11.5' rx='2' />
            <path d='M5 6h6M5 8.5h6M5 11h3.5' />
          </svg>
          All items
        </NavLink>
        <div className='-mt-3 flex flex-col'>
          <PageLink href='/app/saved' count={saved} countLabel='saved'>
            <svg aria-hidden='true' viewBox='0 0 16 16' className={navIcon}>
              <path d='M4 2.25h8v11.5l-4-2.75-4 2.75V2.25Z' />
            </svg>
            Saved
          </PageLink>
          <div className='flex flex-col lg:hidden'>
            <PageLink href='/app/digest'>Digest</PageLink>
            <PageLink href='/app/search'>Search</PageLink>
          </div>
        </div>
        {groups.length > 0 && (
          <section
            aria-labelledby='categories-heading'
            className='border-t border-border-subtle pt-4'
          >
            <h2
              id='categories-heading'
              className='mb-2 px-2 text-xs font-semibold tracking-wider text-text-tertiary uppercase'
            >
              Categories
            </h2>
            <ul className='flex flex-col gap-3'>
              {groups.map((group) => (
                <CategoryGroup
                  key={group.id ?? 'uncategorized'}
                  storageKey={group.id ?? 'uncategorized'}
                  name={group.name}
                  header={
                    <NavLink
                      filter={{ kind: 'category', id: group.id, unreadOnly: false }}
                      count={group.count}
                    >
                      <span
                        aria-hidden='true'
                        className='size-2 shrink-0 rounded-full'
                        style={{ backgroundColor: categoryColor(group.name) }}
                      />
                      <span className='truncate font-medium text-text-primary'>{group.name}</span>
                    </NavLink>
                  }
                >
                  <FeedLinks feeds={group.feeds} counts={counts.byFeed} />
                </CategoryGroup>
              ))}
            </ul>
          </section>
        )}
        <div className='flex flex-col border-t border-border-subtle pt-3'>
          {needAttention > 0 ? (
            <Link
              href='/app/feeds'
              className='flex min-h-9 items-center gap-2 rounded-md px-2 text-xs text-warning hover:bg-bg-tertiary'
            >
              <svg aria-hidden='true' viewBox='0 0 16 16' className='size-3.5 fill-current'>
                <path d='M8 1.5 15 14.5H1L8 1.5Zm-.75 5v4h1.5v-4h-1.5Zm0 5.25v1.5h1.5v-1.5h-1.5Z' />
              </svg>
              {needAttention} {needAttention === 1 ? 'feed needs' : 'feeds need'} attention
            </Link>
          ) : (
            <p className='flex min-h-9 items-center gap-2 px-2 text-xs text-text-secondary'>
              <svg
                aria-hidden='true'
                viewBox='0 0 16 16'
                className='size-3.5 fill-none stroke-success stroke-[1.5]'
              >
                <circle cx='8' cy='8' r='6.25' />
                <path d='m5.5 8 1.75 1.75L10.75 6.5' />
              </svg>
              All feeds healthy
            </p>
          )}
          <Link
            href='/app/feeds'
            className='flex min-h-9 items-center rounded-md px-2 text-text-secondary hover:bg-bg-tertiary hover:text-text-primary pointer-coarse:min-h-11'
          >
            Manage feeds
          </Link>
          <PageLink href='/app/settings'>Settings</PageLink>
        </div>
      </nav>
    </>
  );
}
