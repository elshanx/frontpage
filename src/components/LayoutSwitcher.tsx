'use client';

import { useOptimistic, useTransition } from 'react';
import { setLayoutAction } from '@/app/app/actions';
import { LAYOUTS, type Layout } from '@/lib/reading/layout';

const LABELS: Record<Layout, string> = {
  compact: 'Compact',
  comfortable: 'Comfortable',
  cards: 'Cards',
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
          className='flex min-h-10 cursor-pointer items-center rounded px-3 text-text-secondary hover:text-text-primary has-checked:bg-bg-tertiary has-checked:font-semibold has-checked:text-text-primary has-focus-visible:outline-2 has-focus-visible:outline-accent'
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
          {LABELS[option]}
        </label>
      ))}
    </fieldset>
  );
}
