import 'server-only';
import prisma from '@/lib/db';
import { type Layout, parseLayout } from '@/lib/reading/layout';
import { parseReaderFont, parseReaderRange, type ReaderPrefs } from '@/lib/reading/reader-prefs';
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
    readerFont: parseReaderFont(preference?.readerFont),
    readerSize: parseReaderRange('readerSize', preference?.readerSize),
    readerLeading: parseReaderRange('readerLeading', preference?.readerLeading),
    readerMeasure: parseReaderRange('readerMeasure', preference?.readerMeasure),
    reduceMotion: preference?.reduceMotion ?? false,
  };
}

export async function setPreferences(
  userId: string,
  data: Partial<ReaderPrefs> & {
    refreshMinutes?: RefreshMinutes;
    layout?: Layout;
    digestSeenAt?: Date;
    reduceMotion?: boolean;
  }
) {
  await prisma.preference.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });
}
