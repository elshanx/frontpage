export const MAX_CATEGORY_NAME = 40;

export default function parseCategoryName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  return name.length > 0 && name.length <= MAX_CATEGORY_NAME ? name : null;
}
