export const REFRESH_OPTIONS = [15, 30, 60, 0] as const;
export type RefreshMinutes = (typeof REFRESH_OPTIONS)[number];
export const DEFAULT_REFRESH_MINUTES: RefreshMinutes = 30;

export function parseRefreshMinutes(raw: unknown): RefreshMinutes | null {
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  return REFRESH_OPTIONS.find((option) => String(option) === String(raw)) ?? null;
}
