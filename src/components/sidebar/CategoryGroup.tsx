'use client';

import { type ReactNode, useId, useSyncExternalStore } from 'react';

const COLLAPSED_KEY = 'frontpage:collapsed-categories';

const listeners = new Set<() => void>();

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) ?? '[]';
  } catch {
    return '[]';
  }
}

function parseCollapsed(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((key) => typeof key === 'string') : [];
  } catch {
    return [];
  }
}

function writeCollapsed(keys: string[]) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(keys));
  } catch {
    /* storage unavailable: the preference just won't persist */
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

export default function CategoryGroup({
  storageKey,
  name,
  header,
  children,
}: {
  storageKey: string;
  name: string;
  header: ReactNode;
  children: ReactNode;
}) {
  const collapsed = parseCollapsed(useSyncExternalStore(subscribe, readCollapsed, () => '[]'));
  const open = !collapsed.includes(storageKey);
  const listId = useId();

  const toggle = () =>
    writeCollapsed(
      open ? [...collapsed, storageKey] : collapsed.filter((key) => key !== storageKey)
    );

  return (
    <li>
      <div className='flex items-center'>
        <button
          type='button'
          onClick={toggle}
          aria-expanded={open}
          aria-controls={listId}
          className='grid size-6 shrink-0 place-items-center rounded-md text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary pointer-coarse:size-11'
        >
          <svg
            aria-hidden='true'
            viewBox='0 0 16 16'
            className={`size-3 fill-none stroke-current stroke-2 transition-transform ${open ? 'rotate-90' : ''}`}
          >
            <path d='m6 4 4 4-4 4' />
          </svg>
          <span className='sr-only'>
            {open ? 'Collapse' : 'Expand'} {name}
          </span>
        </button>
        <div className='min-w-0 flex-1'>{header}</div>
      </div>
      <div id={listId} hidden={!open}>
        {children}
      </div>
    </li>
  );
}
