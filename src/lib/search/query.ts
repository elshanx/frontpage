import { ID_PATTERN } from '../reading/filters.ts';
import type { SearchParams as RawParams } from '../reading/filters.ts';

const MAX_TERMS = 8;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface SearchParams {
  q: string;
  feedId: string | null;
  categoryId: string | null;
  from: Date | null;
  to: Date | null;
}

export function toTsQuery(raw: string): string | null {
  const terms = (raw.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, MAX_TERMS);
  if (!terms.length) return null;
  return `${terms.join(' & ')}:*`;
}

const first = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) ?? '';

const id = (value: string | string[] | undefined) => {
  const raw = first(value);
  return ID_PATTERN.test(raw) ? raw : null;
};

function date(value: string | string[] | undefined, endOfDay: boolean): Date | null {
  const raw = first(value);
  if (!DATE.test(raw)) return null;
  const parsed = new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw
    ? null
    : parsed;
}

export function parseSearchParams(params: RawParams): SearchParams {
  return {
    q: first(params.q).trim().slice(0, 200),
    feedId: id(params.feed),
    categoryId: id(params.category),
    from: date(params.from, false),
    to: date(params.to, true),
  };
}
