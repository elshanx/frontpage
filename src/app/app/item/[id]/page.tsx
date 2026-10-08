import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { summarizeItemAction } from '@/app/app/actions';
import AiPanel from '@/components/AiPanel';
import FeedIcon from '@/components/FeedIcon';
import MarkReadOnView from '@/components/MarkReadOnView';
import ReaderNav from '@/components/ReaderNav';
import SaveButton from '@/components/SaveButton';
import { aiEnabled } from '@/lib/ai/client';
import { getItemForUser, getNeighbors } from '@/lib/items';
import { ID_PATTERN, filterToSearch, parseListFilter } from '@/lib/reading/filters';
import { getPreferences } from '@/lib/preferences';
import { readerStyle } from '@/lib/reading/reader-prefs';
import { requireUser } from '@/lib/session';

const fullDate = new Intl.DateTimeFormat('en', { dateStyle: 'long' });

async function loadItem(id: string) {
  const user = await requireUser();
  const item = ID_PATTERN.test(id) ? await getItemForUser(user.id, id) : null;
  if (!item) notFound();
  return { user, item };
}

export async function generateMetadata({ params }: PageProps<'/app/item/[id]'>): Promise<Metadata> {
  const { item } = await loadItem((await params).id);
  return { title: item.title };
}

function siteName(url: string) {
  return new URL(url).hostname.replace(/^www\./, '');
}

export default async function ReaderPage({ params, searchParams }: PageProps<'/app/item/[id]'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { user, item } = await loadItem(id);
  const filter = parseListFilter(query);
  const from = filterToSearch(filter);
  const [{ newerId, olderId }, prefs] = await Promise.all([
    getNeighbors(user.id, filter, item),
    getPreferences(user.id),
  ]);
  const textWidth = Math.round(prefs.readerMeasure * prefs.readerSize * 0.5);
  const original = item.url ?? item.siteUrl;

  return (
    <main
      id='main'
      className='mx-auto px-4 py-6'
      style={{ ...readerStyle(prefs), maxWidth: `max(45rem, ${textWidth}px + 2rem)` }}
    >
      <MarkReadOnView id={item.id} unread={item.unread} />
      <ReaderNav from={from} newerId={newerId} olderId={olderId} label='Article navigation' />
      <article className='mt-6'>
        <header className='border-b border-border-subtle pb-4'>
          <div className='flex items-start justify-between gap-3'>
            <h1 className='font-serif text-2xl font-bold'>{item.title}</h1>
            <SaveButton itemId={item.id} saved={item.saved} />
          </div>
          <p className='mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-secondary'>
            <FeedIcon src={item.iconUrl} title={item.feedTitle} />
            <span>{item.feedTitle}</span>
            {item.author && (
              <>
                <span aria-hidden='true'>·</span>
                <span>{item.author}</span>
              </>
            )}
            <span aria-hidden='true'>·</span>
            <time dateTime={item.publishedAt.toISOString()} suppressHydrationWarning>
              {fullDate.format(item.publishedAt)}
            </time>
          </p>
          {original && (
            <a
              href={original}
              target='_blank'
              rel='noopener noreferrer'
              className='mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent underline'
            >
              Open original<span aria-hidden='true'>&nbsp;↗</span>
              <span className='sr-only'> (opens in a new tab)</span>
            </a>
          )}
        </header>
        {aiEnabled && (
          <AiPanel
            title='AI summary'
            buttonLabel='Summarize this article'
            cached={item.aiSummary}
            action={summarizeItemAction}
            target={item.id}
          />
        )}
        {item.contentHtml ? (
          <div
            className='reader-content mt-6'
            // eslint-disable-next-line react/no-danger -- sanitized with sanitize-html at ingest (src/lib/feeds/html.ts)
            dangerouslySetInnerHTML={{ __html: item.contentHtml }}
          />
        ) : (
          <div className='reader-content mt-6'>
            {item.excerpt && <p>{item.excerpt}</p>}
            {original && (
              <a
                href={original}
                target='_blank'
                rel='noopener noreferrer'
                className='mt-6 inline-flex min-h-11 items-center rounded-md bg-accent px-4 font-sans text-base font-semibold text-white hover:bg-accent-hover'
              >
                Read the full article on {siteName(original)}
                <span className='sr-only'> (opens in a new tab)</span>
              </a>
            )}
          </div>
        )}
      </article>
      <div className='mt-10 border-t border-border-subtle pt-4'>
        <ReaderNav from={from} newerId={newerId} olderId={olderId} label='More articles' />
      </div>
    </main>
  );
}
