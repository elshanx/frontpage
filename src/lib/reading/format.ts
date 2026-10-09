const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MAX_BADGE = 99;

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' });
const sameYear = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' });
const otherYear = new Intl.DateTimeFormat('en', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

export function relativeTime(date: Date, now: Date): string {
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), 'minute');
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), 'hour');
  if (elapsed < 7 * DAY) return relative.format(-Math.floor(elapsed / DAY), 'day');
  return (date.getFullYear() === now.getFullYear() ? sameYear : otherYear).format(date);
}

export function badgeCount(n: number): string {
  if (n <= 0) return '';
  return n > MAX_BADGE ? `${MAX_BADGE}+` : String(n);
}

const CATEGORY_COLORS = [
  '#3b82f6',
  '#ec4899',
  '#f59e0b',
  '#6366f1',
  '#a855f7',
  '#10b981',
  '#ef4444',
  '#14b8a6',
];

export const categoryColor = (name: string) =>
  CATEGORY_COLORS[
    [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % CATEGORY_COLORS.length
  ];
