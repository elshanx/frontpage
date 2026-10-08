import { getSession } from '@/lib/session';
import buildOpml from '@/lib/opml/build';
import { listManagedFeeds } from '@/lib/subscriptions';

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const { categories, uncategorized } = await listManagedFeeds(session.user.id);
  const toFeeds = (feeds: typeof uncategorized) =>
    feeds.map(({ title, url, siteUrl }) => ({ title, url, siteUrl }));
  const xml = buildOpml(
    [
      ...categories.map(({ name, feeds }) => ({ name, feeds: toFeeds(feeds) })),
      { name: null, feeds: toFeeds(uncategorized) },
    ],
    'Frontpage subscriptions'
  );
  return new Response(xml, {
    headers: {
      'Content-Type': 'text/x-opml; charset=utf-8',
      'Content-Disposition': 'attachment; filename="frontpage-subscriptions.opml"',
      'Cache-Control': 'no-store',
    },
  });
}
