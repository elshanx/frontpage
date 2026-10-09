'use client';

import { useEffect, useState } from 'react';

interface MockRow {
  id: number;
  feed: string;
  title: string;
  age: string;
  unread: boolean;
}

const INITIAL_ROWS: MockRow[] = [
  {
    id: 0,
    feed: 'Vercel Changelog',
    title: 'Faster cold starts for Node.js functions',
    age: '12m',
    unread: true,
  },
  { id: 1, feed: 'Julia Evans', title: 'Some notes on DNS caching', age: '1h', unread: true },
  { id: 2, feed: 'Overreacted', title: 'The two Reacts', age: '3h', unread: true },
  {
    id: 3,
    feed: 'Simon Willison',
    title: 'Things I learned building with LLM tools',
    age: '5h',
    unread: false,
  },
  {
    id: 4,
    feed: 'CSS-Tricks',
    title: 'A practical guide to container queries',
    age: '1d',
    unread: false,
  },
];

const INCOMING = [
  { feed: 'Smashing Magazine', title: 'Designing calmer notification systems' },
  { feed: 'The GitHub Blog', title: 'What’s new in code search' },
  { feed: 'web.dev', title: 'Baseline features you can use today' },
  { feed: 'Cloudflare Blog', title: 'How we cut tail latency in half' },
  { feed: 'Josh W. Comeau', title: 'An interactive guide to CSS grid' },
];

const CATEGORIES = ['All items', 'Frontend', 'Backend & DevOps', 'Newsletters'];
const STEP_MS = 2600;
const STEPS_PER_ARRIVAL = 3;

function prefersReducedMotion() {
  return (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    document.querySelector('[data-reduce-motion]') !== null
  );
}

export default function LiveMock() {
  const [rows, setRows] = useState(INITIAL_ROWS);
  const [cursor, setCursor] = useState(-1);
  const [total, setTotal] = useState(42);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    let tick = 0;
    let position = -1;
    let nextId = INITIAL_ROWS.length;
    const timer = setInterval(() => {
      tick += 1;
      if (tick % (STEPS_PER_ARRIVAL + 1) === 0) {
        const incoming = INCOMING[(nextId - INITIAL_ROWS.length) % INCOMING.length];
        const row = { ...incoming, id: nextId, age: 'now', unread: true };
        nextId += 1;
        position = -1;
        setRows((current) => [row, ...current.slice(0, -1)]);
        setTotal((current) => current + 1);
        setCursor(position);
        return;
      }
      position += 1;
      const readIndex = position;
      setRows((current) =>
        current.map((row, index) => (index === readIndex ? { ...row, unread: false } : row))
      );
      setCursor(position);
    }, STEP_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      aria-hidden='true'
      className='overflow-hidden rounded-xl border border-border bg-bg-primary text-left shadow-lg'
    >
      <div className='flex items-center gap-1.5 border-b border-border-subtle bg-bg-secondary px-3 py-2'>
        <span className='size-2.5 rounded-full bg-[#ff5f57]' />
        <span className='size-2.5 rounded-full bg-[#febc2e]' />
        <span className='size-2.5 rounded-full bg-[#28c840]' />
      </div>
      <div className='flex'>
        <div className='hidden w-44 shrink-0 flex-col gap-1 border-r border-border-subtle bg-bg-secondary p-3 text-xs sm:flex'>
          {CATEGORIES.map((name, index) => (
            <span
              key={name}
              className={`flex justify-between rounded px-2 py-1.5 ${index === 0 ? 'bg-accent-subtle font-semibold text-text-primary' : 'text-text-secondary'}`}
            >
              {name}
              <span
                key={index === 0 ? total : undefined}
                className='animate-rise text-text-tertiary tabular-nums'
              >
                {index === 0 ? total : [18, 9, 15][index - 1]}
              </span>
            </span>
          ))}
        </div>
        <ul className='min-w-0 flex-1 overflow-hidden px-4'>
          {rows.map(({ id, feed, title, age, unread }, index) => (
            <li
              key={id}
              className={`-mx-4 flex animate-slide-in gap-3 border-b border-l-2 border-b-border-subtle px-4 py-3 transition-colors duration-300 last:border-b-0 ${index === cursor ? 'border-l-accent bg-accent-subtle' : 'border-l-transparent'}`}
            >
              <span
                className={`mt-1.5 size-2 shrink-0 rounded-full transition-colors duration-500 ${unread ? 'animate-soft-pulse bg-unread' : 'bg-transparent'}`}
              />
              <span className='min-w-0'>
                <span
                  className={`block truncate text-sm transition-colors duration-500 ${unread ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}
                >
                  {title}
                </span>
                <span className='text-xs text-text-tertiary'>
                  {feed} · {age}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
