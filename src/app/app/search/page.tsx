import type { Metadata } from 'next';
import Link from 'next/link';
import FeedIcon from '@/components/FeedIcon';
import Highlighted from '@/components/Highlighted';
import SearchForm from '@/components/SearchForm';
import { getNavigation, searchItems } from '@/lib/items';
import { parseSearchParams } from '@/lib/search/query';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Search' };

const fullDate = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
const text = (value: string | string[] | undefined) => (typeof value === 'string' ? value : '');

export default async function SearchPage({ searchParams }: PageProps<'/app/search'>) {
  const [user, raw] = await Promise.all([requireUser(), searchParams]);
  const params = parseSearchParams(raw);
  const [results, { categories, uncategorized }] = await Promise.all([
    searchItems(user.id, params),
    getNavigation(user.id),
  ]);
  const feeds = [...categories.flatMap((category) => category.feeds), ...uncategorized]
    .map(({ id, title }) => ({ id, name: title }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <main id='main' className='mx-auto max-w-feed px-4 py-6'>
      <h1 className='mb-4 text-xl font-semibold'>Search</h1>
      <SearchForm
        initial={{
          q: params.q,
          feed: params.feedId ?? '',
          category: params.categoryId ?? '',
          from: text(raw.from),
          to: text(raw.to),
        }}
        feeds={feeds}
        categories={categories.map(({ id, name }) => ({ id, name }))}
      >
        {params.q &&
          (results.length ? (
            <>
              <p className='text-sm text-text-secondary'>
                {results.length === 50
                  ? 'Top 50 results'
                  : `${results.length} ${results.length === 1 ? 'result' : 'results'}`}
              </p>
              <ul>
                {results.map((item) => (
                  <li key={item.id} className='border-b border-border-subtle py-3'>
                    <h2 className='text-base font-semibold'>
                      <Link href={`/app/item/${item.id}`} className='hover:text-accent'>
                        <Highlighted text={item.titleHighlight} />
                      </Link>
                    </h2>
                    <p className='mt-1 flex items-center gap-1.5 text-sm text-text-tertiary'>
                      <FeedIcon src={item.iconUrl} title={item.feedTitle} />
                      <span className='truncate'>{item.feedTitle}</span>
                      <span aria-hidden='true'>·</span>
                      <time dateTime={item.publishedAt.toISOString()}>
                        {fullDate.format(item.publishedAt)}
                      </time>
                    </p>
                    {item.excerptHighlight && (
                      <p className='mt-1 line-clamp-3 text-sm text-text-secondary'>
                        <Highlighted text={item.excerptHighlight} />
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className='py-12 text-center text-text-secondary'>
              <p className='font-semibold text-text-primary'>No articles match “{params.q}”</p>
              <p className='mt-2 text-sm'>
                Try fewer or different words, or clear the filters. Search covers titles and
                summaries of items from feeds you follow.
              </p>
            </div>
          ))}
      </SearchForm>
    </main>
  );
}
