'use server';

import { redirect } from 'next/navigation';
import { setPreferences } from '@/lib/preferences';
import { parseRefreshMinutes } from '@/lib/reading/refresh-interval';
import { requireUser } from '@/lib/session';

export default async function saveSettingsAction(formData: FormData) {
  const user = await requireUser();
  const refreshMinutes = parseRefreshMinutes(formData.get('refreshMinutes'));
  if (refreshMinutes !== null) await setPreferences(user.id, { refreshMinutes });
  redirect('/app/settings?saved=1');
}
