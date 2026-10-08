import 'server-only';
import prisma from '@/lib/db';
import { type Layout, parseLayout } from '@/lib/reading/layout';
import {
  DEFAULT_REFRESH_MINUTES,
  parseRefreshMinutes,
  type RefreshMinutes,
} from '@/lib/reading/refresh-interval';

export async function getPreferences(userId: string) {
  const preference = await prisma.preference.findUnique({ where: { userId } });
  return {
    refreshMinutes: parseRefreshMinutes(preference?.refreshMinutes) ?? DEFAULT_REFRESH_MINUTES,
    layout: parseLayout(preference?.layout),
    digestSeenAt: preference?.digestSeenAt ?? null,
  };
}

export async function setPreferences(
  userId: string,
  data: { refreshMinutes?: RefreshMinutes; layout?: Layout; digestSeenAt?: Date }
) {
  await prisma.preference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}
