'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react';
import type { CategoryOption } from '@/components/CategorySelect';

const DEBOUNCE_MS = 200;
const RECENT_KEY = 'frontpage:recent-searches';
const MAX_RECENT = 8;

export interface SearchValues {
  q: string;
  feed: string;
  category: string;
  from: string;
  to: string;
}

const RECENT_EVENT = 'frontpage:recent-searches';

function rawRecent(): string {
  try {
    return localStorage.getItem(RECENT_KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function parseRecent(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

function writeRecent(values: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(values));
  } catch {
    // Storage can be unavailable (private mode); recent searches are optional.
  }
  window.dispatchEvent(new Event(RECENT_EVENT));
}

function subscribeRecent(onChange: () => void) {
  window.addEventListener(RECENT_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(RECENT_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

const fieldClass = 'min-h-11 rounded-md border border-border bg-surface px-3 text-base';

export default function SearchForm({
  initial,
  feeds,
  categories,
  children,
}: {
  initial: SearchValues;
  feeds: CategoryOption[];
  categories: CategoryOption[];
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  const [values, setValues] = useState(initial);
  const recent = parseRecent(useSyncExternalStore(subscribeRecent, rawRecent, () => '[]'));
  const [isPending, startTransition] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return undefined;
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(
        Object.entries(values).filter(([, value]) => value.trim())
      );
      startTransition(() => router.replace(`${pathname}?${params}`, { scroll: false }));
      const q = values.q.trim();
      if (q.length > 1) {
        writeRecent(
          [q, ...parseRecent(rawRecent()).filter((item) => item !== q)].slice(0, MAX_RECENT)
        );
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [values, pathname, router]);

  const set = (name: keyof SearchValues) => (value: string) =>
    setValues((current) => ({ ...current, [name]: value }));
  const hasFilters = Boolean(values.feed || values.category || values.from || values.to);

  return (
    <div className='flex flex-col gap-4'>
      <form
        role='search'
        onSubmit={(event) => event.preventDefault()}
        className='flex flex-col gap-3'
      >
        <label htmlFor={`${id}-q`} className='flex flex-col gap-1'>
          <span className='text-sm font-medium'>Search articles</span>
          <input
            id={`${id}-q`}
            type='search'
            value={values.q}
            onChange={(event) => set('q')(event.target.value)}
            placeholder='Titles and summaries'
            autoComplete='off'
            className={fieldClass}
          />
        </label>
        <div className='grid gap-3 sm:grid-cols-4'>
          <label htmlFor={`${id}-feed`} className='flex flex-col gap-1'>
            <span className='text-sm font-medium'>Feed</span>
            <select
              id={`${id}-feed`}
              value={values.feed}
              onChange={(event) => set('feed')(event.target.value)}
              className={fieldClass}
            >
              <option value=''>All feeds</option>
              {feeds.map(({ id: value, name }) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-category`} className='flex flex-col gap-1'>
            <span className='text-sm font-medium'>Category</span>
            <select
              id={`${id}-category`}
              value={values.category}
              onChange={(event) => set('category')(event.target.value)}
              className={fieldClass}
            >
              <option value=''>All categories</option>
              {categories.map(({ id: value, name }) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-from`} className='flex flex-col gap-1'>
            <span className='text-sm font-medium'>From</span>
            <input
              id={`${id}-from`}
              type='date'
              value={values.from}
              onChange={(event) => set('from')(event.target.value)}
              className={fieldClass}
            />
          </label>
          <label htmlFor={`${id}-to`} className='flex flex-col gap-1'>
            <span className='text-sm font-medium'>To</span>
            <input
              id={`${id}-to`}
              type='date'
              value={values.to}
              onChange={(event) => set('to')(event.target.value)}
              className={fieldClass}
            />
          </label>
        </div>
        {hasFilters && (
          <button
            type='button'
            onClick={() =>
              setValues((current) => ({ ...current, feed: '', category: '', from: '', to: '' }))
            }
            className='self-start text-sm font-semibold text-accent underline'
          >
            Clear filters
          </button>
        )}
      </form>

      {!values.q.trim() && recent.length > 0 && (
        <section aria-labelledby={`${id}-recent`}>
          <div className='flex items-center justify-between'>
            <h2 id={`${id}-recent`} className='text-sm font-semibold text-text-secondary'>
              Recent searches
            </h2>
            <button
              type='button'
              onClick={() => {
                writeRecent([]);
              }}
              className='text-sm text-text-secondary underline'
            >
              Clear
            </button>
          </div>
          <ul className='mt-2 flex flex-wrap gap-2'>
            {recent.map((item) => (
              <li key={item}>
                <button
                  type='button'
                  onClick={() => set('q')(item)}
                  className='min-h-9 rounded-full border border-border px-3 text-sm hover:bg-bg-tertiary pointer-coarse:min-h-11'
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div aria-live='polite' aria-busy={isPending} className={isPending ? 'opacity-60' : ''}>
        {children}
      </div>
    </div>
  );
}
