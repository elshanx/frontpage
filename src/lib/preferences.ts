import 'server-only';
import prisma from '@/lib/db';
import {
  DEFAULT_REFRESH_MINUTES,
  parseRefreshMinutes,
  type RefreshMinutes,
} from '@/lib/reading/refresh-interval';

export async function getRefreshMinutes(userId: string): Promise<RefreshMinutes> {
  const preference = await prisma.preference.findUnique({
    where: { userId },
    select: { refreshMinutes: true },
  });
  return parseRefreshMinutes(preference?.refreshMinutes) ?? DEFAULT_REFRESH_MINUTES;
}

export async function setRefreshMinutes(userId: string, refreshMinutes: RefreshMinutes) {
  await prisma.preference.upsert({
    where: { userId },
    create: { userId, refreshMinutes },
    update: { refreshMinutes },
  });
}
