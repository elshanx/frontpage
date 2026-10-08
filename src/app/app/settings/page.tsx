import type { Metadata } from 'next';
import saveSettingsAction from '@/app/app/settings/actions';
import { getPreferences } from '@/lib/preferences';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Settings' };

const INTERVALS = [
  { value: 15, label: 'Every 15 minutes' },
  { value: 30, label: 'Every 30 minutes' },
  { value: 60, label: 'Every hour' },
  { value: 0, label: 'Only when I press Refresh' },
];

export default async function SettingsPage({ searchParams }: PageProps<'/app/settings'>) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  const { refreshMinutes } = await getPreferences(user.id);

  return (
    <main id='main' className='mx-auto max-w-feed px-4 py-6'>
      <h1 className='text-xl font-semibold'>Settings</h1>
      <form action={saveSettingsAction} className='mt-6 flex flex-col gap-4'>
        <fieldset className='flex flex-col gap-1'>
          <legend className='mb-2 font-semibold'>Check for new items</legend>
          {INTERVALS.map(({ value, label }) => (
            <label
              key={value}
              htmlFor={`refresh-${value}`}
              className='flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-bg-tertiary'
            >
              <input
                id={`refresh-${value}`}
                type='radio'
                name='refreshMinutes'
                value={value}
                defaultChecked={value === refreshMinutes}
                className='size-4 accent-accent'
              />
              {label}
            </label>
          ))}
        </fieldset>
        <div className='flex items-center gap-3'>
          <button
            type='submit'
            className='min-h-11 rounded-md bg-accent px-5 font-semibold text-white hover:bg-accent-hover'
          >
            Save
          </button>
          <p role='status' className='text-sm text-success'>
            {params.saved ? 'Settings saved' : ''}
          </p>
        </div>
      </form>
    </main>
  );
}
