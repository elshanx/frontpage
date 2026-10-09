'use client';

import { useOptimistic, useTransition } from 'react';
import { setLayoutAction } from '@/app/app/actions';
import { LAYOUTS, type Layout } from '@/lib/reading/layout';

const LABELS: Record<Layout, string> = {
  compact: 'Compact',
  comfortable: 'Comfortable',
  cards: 'Cards',
};

const ICONS: Record<Layout, string> = {
  comfortable: 'M2.5 4h11M2.5 8h11M2.5 12h11',
  cards:
    'M2.75 2.75h4.5v4.5h-4.5zM8.75 2.75h4.5v4.5h-4.5zM2.75 8.75h4.5v4.5h-4.5zM8.75 8.75h4.5v4.5h-4.5z',
  compact: 'M2.5 3h11M2.5 6.33h11M2.5 9.67h11M2.5 13h11',
};

export default function LayoutSwitcher({ layout }: { layout: Layout }) {
  const [current, setCurrent] = useOptimistic(layout);
  const [, startTransition] = useTransition();

  const choose = (next: Layout) =>
    startTransition(async () => {
      setCurrent(next);
      await setLayoutAction(next);
    });

  return (
    <fieldset className='flex rounded-md border border-border p-0.5 text-sm'>
      <legend className='sr-only'>Layout</legend>
      {LAYOUTS.map((option) => (
        <label
          key={option}
          htmlFor={`layout-${option}`}
          title={LABELS[option]}
          className='grid size-9 cursor-pointer place-items-center rounded text-text-secondary hover:text-text-primary has-checked:bg-bg-tertiary has-checked:font-semibold has-checked:text-text-primary has-focus-visible:outline-2 has-focus-visible:outline-accent'
        >
          <input
            id={`layout-${option}`}
            type='radio'
            name='layout'
            value={option}
            checked={current === option}
            onChange={() => choose(option)}
            className='sr-only'
          />
          <svg
            aria-hidden='true'
            viewBox='0 0 16 16'
            className='size-4 fill-none stroke-current stroke-[1.5]'
          >
            <path d={ICONS[option]} />
          </svg>
          <span className='sr-only'>{LABELS[option]}</span>
        </label>
      ))}
    </fieldset>
  );
}
