const ZONE_OFFSETS: Record<string, string> = {
  UTC: '+0000',
  WET: '+0000',
  CET: '+0100',
  CEST: '+0200',
  BST: '+0100',
  EET: '+0200',
  EEST: '+0300',
  IST: '+0530',
  JST: '+0900',
  KST: '+0900',
  AEST: '+1000',
  AEDT: '+1100',
};
const NAIVE_ISO = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)?$/;
const LEADING_WEEKDAY = /^[a-z]+,\s*/i;
const TRAILING_ZONE = /\b([A-Z]{3,4})$/;
const MIN_YEAR = 1990;

export function parseDate(raw: string | null | undefined): Date | null {
  const text = raw?.trim().replace(/\s+/g, ' ');
  if (!text) return null;

  let normalized = text
    .replace(LEADING_WEEKDAY, '')
    .replace(TRAILING_ZONE, (zone) => ZONE_OFFSETS[zone] ?? zone);
  if (NAIVE_ISO.test(normalized)) {
    normalized =
      normalized.length === 10 ? `${normalized}T00:00:00Z` : `${normalized.replace(' ', 'T')}Z`;
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < MIN_YEAR) return null;
  return date;
}
