import isCronAuthorized from '@/lib/accounts/cron';
import env from '@/lib/env';
import purgeExpiredGuests from '@/lib/guests';
import {
  purgeAiBookkeeping,
  purgeOldItems,
  purgeOrphanFeeds,
  refreshDueFeeds,
} from '@/lib/maintenance';

export const maxDuration = 300;

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'), env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const now = new Date();
  const purgedGuests = await purgeExpiredGuests(now);
  const purgedFeeds = await purgeOrphanFeeds();
  const purgedItems = await purgeOldItems(now);
  const purgedAiRows = await purgeAiBookkeeping(now);
  const refreshed = await refreshDueFeeds(now);
  return Response.json({ purgedGuests, purgedFeeds, purgedItems, purgedAiRows, refreshed });
}
