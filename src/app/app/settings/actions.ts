'use server';

import { redirect } from 'next/navigation';
import { setPreferences } from '@/lib/preferences';
import { parseReaderFont, parseReaderRange } from '@/lib/reading/reader-prefs';
import { parseRefreshMinutes } from '@/lib/reading/refresh-interval';
import { requireUser } from '@/lib/session';

export default async function saveSettingsAction(formData: FormData) {
  const user = await requireUser();
  const refreshMinutes = parseRefreshMinutes(formData.get('refreshMinutes'));
  await setPreferences(user.id, {
    ...(refreshMinutes !== null && { refreshMinutes }),
    readerFont: parseReaderFont(formData.get('readerFont')),
    readerSize: parseReaderRange('readerSize', formData.get('readerSize')),
    readerLeading: parseReaderRange('readerLeading', formData.get('readerLeading')),
    readerMeasure: parseReaderRange('readerMeasure', formData.get('readerMeasure')),
  });
  redirect('/app/settings?saved=1');
}
