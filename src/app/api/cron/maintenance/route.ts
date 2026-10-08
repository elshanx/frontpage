import isCronAuthorized from '@/lib/accounts/cron';
import env from '@/lib/env';
import purgeExpiredGuests from '@/lib/guests';

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get('authorization'), env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const purgedGuests = await purgeExpiredGuests(new Date());
  return Response.json({ purgedGuests });
}
