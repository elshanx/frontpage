'use client';

import { ThemeProvider, useTheme } from 'next-themes';
import { type ReactNode, useEffect, useSyncExternalStore } from 'react';

const THEMES = ['light', 'dark', 'high-contrast'];
const MORE_CONTRAST = '(prefers-contrast: more)';

function SystemContrast() {
  const { theme, resolvedTheme } = useTheme();

  useEffect(() => {
    if (theme !== 'system') return undefined;
    const query = window.matchMedia(MORE_CONTRAST);
    const apply = () => {
      document.documentElement.dataset.theme = query.matches ? 'high-contrast' : resolvedTheme;
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [theme, resolvedTheme]);

  return null;
}

export default function Theme({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute='data-theme' themes={THEMES} enableSystem disableTransitionOnChange>
      <SystemContrast />
      {children}
    </ThemeProvider>
  );
}

const OPTIONS = [
  { value: 'system', label: 'Match my device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'high-contrast', label: 'High contrast' },
];

const subscribe = () => () => {};

export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  return (
    <fieldset className='flex flex-col gap-1'>
      <legend className='mb-2 font-semibold'>Theme</legend>
      {OPTIONS.map(({ value, label }) => (
        <label
          key={value}
          htmlFor={`theme-${value}`}
          className='flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-bg-tertiary'
        >
          <input
            id={`theme-${value}`}
            type='radio'
            name='theme'
            value={value}
            checked={mounted && theme === value}
            onChange={() => setTheme(value)}
            className='size-4 accent-accent'
          />
          {label}
        </label>
      ))}
      <p className='px-2 text-sm text-text-secondary'>
        Applies right away on this device. With “Match my device”, high contrast turns on when your
        system asks for more contrast.
      </p>
    </fieldset>
  );
}
