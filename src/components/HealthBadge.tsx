import type { FeedHealth } from '@/lib/feeds/health';

const BADGES: Record<FeedHealth, { label: string; icon: string; className: string }> = {
  active: { label: 'Active', icon: '●', className: 'text-success' },
  stale: { label: 'Stale', icon: '◐', className: 'text-warning' },
  error: { label: 'Error', icon: '▲', className: 'text-error' },
  dead: { label: 'Dead', icon: '✕', className: 'text-error' },
  pending: { label: 'Checking…', icon: '○', className: 'text-text-secondary' },
};

export default function HealthBadge({
  health,
  count = undefined,
}: {
  health: FeedHealth;
  count?: number;
}) {
  const { label, icon, className } = BADGES[health];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${className}`}>
      <span aria-hidden='true'>{icon}</span>
      {count === undefined ? label : `${count} ${label.toLowerCase()}`}
    </span>
  );
}
