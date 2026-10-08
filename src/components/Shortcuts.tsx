'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

const SHORTCUTS = [
  { keys: ['j', 'k'], label: 'Next / previous item' },
  { keys: ['o', 'Enter'], label: 'Open selected item' },
  { keys: ['s'], label: 'Save or unsave' },
  { keys: ['m'], label: 'Mark read or unread' },
  { keys: ['u'], label: 'Back to list (in an article)' },
  { keys: ['g', 'h'], label: 'Go to all items' },
  { keys: ['g', 's'], label: 'Go to saved' },
  { keys: ['g', 'f'], label: 'Go to feeds' },
  { keys: ['/'], label: 'Search' },
  { keys: ['⌘', 'K'], label: 'Command palette' },
  { keys: ['?'], label: 'Show this list' },
];

const GO_TO: Record<string, string> = { h: '/app', s: '/app/saved', f: '/app/feeds' };
const SEQUENCE_MS = 1_000;

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
  );
}

const click = (selector: string, root: ParentNode = document) =>
  root.querySelector<HTMLElement>(selector)?.click();

function moveSelection(step: number) {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-item-row]')];
  if (!rows.length) return false;
  const current = rows.findIndex((row) => row.contains(document.activeElement));
  const next = rows[current === -1 ? 0 : Math.min(rows.length - 1, Math.max(0, current + step))];
  const link = next.querySelector<HTMLElement>('[data-action=open]');
  link?.focus();
  link?.scrollIntoView({ block: 'nearest' });
  return true;
}

const selectedRow = () => document.activeElement?.closest('[data-item-row]') ?? null;

export default function Shortcuts() {
  const router = useRouter();
  const pathname = usePathname();
  const sheet = useRef<HTMLDialogElement>(null);
  const pending = useRef<{ key: string; at: number } | null>(null);
  const focusSearch = useRef(false);

  useEffect(() => {
    if (pathname !== '/app/search' || !focusSearch.current) return;
    focusSearch.current = false;
    document.querySelector<HTMLInputElement>('main input')?.focus();
  }, [pathname]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      if (isTyping(event.target) || document.querySelector('dialog[open]')) return;
      const { key } = event;
      const previous = pending.current;
      pending.current = null;

      if (previous?.key === 'g' && Date.now() - previous.at < SEQUENCE_MS && GO_TO[key]) {
        router.push(GO_TO[key]);
      } else if (key === 'g') {
        pending.current = { key, at: Date.now() };
      } else if (key === 'j' || key === 'k') {
        if (!moveSelection(key === 'j' ? 1 : -1)) click(`[data-shortcut=${key}]`);
      } else if (key === 'o') {
        click('[data-action=open]', selectedRow() ?? document.createDocumentFragment());
      } else if (key === 's' || key === 'm') {
        const action = key === 's' ? 'save' : 'read';
        click(
          `[data-action=${action}]`,
          selectedRow() ?? document.querySelector('main') ?? document
        );
      } else if (key === 'u') {
        click('[data-shortcut=u]');
      } else if (key === '/') {
        if (pathname === '/app/search')
          document.querySelector<HTMLInputElement>('main input')?.focus();
        else {
          focusSearch.current = true;
          router.push('/app/search');
        }
      } else if (key === '?') {
        sheet.current?.showModal();
      } else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [router, pathname]);

  return (
    <dialog
      ref={sheet}
      aria-labelledby='shortcuts-title'
      className='m-auto w-[min(28rem,calc(100%-2rem))] rounded-lg border border-border bg-surface p-5 text-text-primary shadow-lg backdrop:bg-black/50'
    >
      <div className='flex items-center justify-between'>
        <h2 id='shortcuts-title' className='font-semibold'>
          Keyboard shortcuts
        </h2>
        <form method='dialog'>
          <button
            type='submit'
            className='min-h-11 rounded-md px-3 text-sm font-medium text-text-secondary hover:bg-bg-tertiary'
          >
            Close
          </button>
        </form>
      </div>
      <dl className='mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm'>
        {SHORTCUTS.map(({ keys, label }) => (
          <div key={label} className='contents'>
            <dt className='flex gap-1'>
              {keys.map((key) => (
                <kbd
                  key={key}
                  className='rounded border border-border bg-bg-tertiary px-1.5 font-mono text-xs'
                >
                  {key}
                </kbd>
              ))}
            </dt>
            <dd className='text-text-secondary'>{label}</dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}
