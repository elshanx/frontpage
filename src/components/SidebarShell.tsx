'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useSyncExternalStore } from 'react';

const COLLAPSED_KEY = 'frontpage:sidebar-collapsed';

const listeners = new Set<() => void>();

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
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

function PanelIcon() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 16 16'
      className='size-4 fill-none stroke-current stroke-[1.5]'
    >
      <rect x='1.75' y='2.75' width='12.5' height='10.5' rx='1.5' />
      <path d='M6 2.75v10.5' />
    </svg>
  );
}

export default function SidebarShell({ children }: { children: ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);
  const drawer = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => drawer.current?.close(), [pathname, search]);

  const toggle = () => writeCollapsed(!collapsed);

  const iconButton =
    'grid size-9 place-items-center rounded-md text-text-secondary hover:bg-bg-tertiary hover:text-text-primary pointer-coarse:size-11';

  return (
    <>
      <div className='border-b border-border-subtle px-2 py-1 lg:hidden'>
        <button
          type='button'
          onClick={() => drawer.current?.showModal()}
          className='flex min-h-11 items-center gap-2 rounded-md px-2 text-sm font-medium text-text-secondary hover:bg-bg-tertiary'
        >
          <PanelIcon />
          Feeds
        </button>
      </div>

      <dialog
        ref={drawer}
        aria-label='Feeds'
        className='m-0 h-dvh max-h-none w-[min(20rem,85vw)] max-w-none bg-bg-primary text-text-primary shadow-lg backdrop:bg-black/40 lg:hidden'
      >
        <div className='flex justify-end p-2'>
          <button type='button' onClick={() => drawer.current?.close()} className={iconButton}>
            <span aria-hidden='true'>✕</span>
            <span className='sr-only'>Close feeds</span>
          </button>
        </div>
        {children}
      </dialog>

      <aside
        data-collapsed={collapsed || undefined}
        className='sticky top-0 hidden h-dvh w-sidebar shrink-0 overflow-y-auto border-r border-border-subtle bg-bg-secondary data-collapsed:w-auto lg:block'
      >
        <div className='flex justify-end p-2'>
          <button
            type='button'
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls='sidebar-content'
            className={iconButton}
          >
            <PanelIcon />
            <span className='sr-only'>{collapsed ? 'Show sidebar' : 'Hide sidebar'}</span>
          </button>
        </div>
        <div id='sidebar-content' hidden={collapsed}>
          {children}
        </div>
      </aside>
    </>
  );
}
