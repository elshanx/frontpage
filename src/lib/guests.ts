import 'server-only';
import prisma from '@/lib/db';

const GUEST_LIFETIME_MS = 24 * 60 * 60 * 1000;

export default async function purgeExpiredGuests(now: Date) {
  const { count } = await prisma.user.deleteMany({
    where: { isAnonymous: true, createdAt: { lt: new Date(now.getTime() - GUEST_LIFETIME_MS) } },
  });
  return count;
}
