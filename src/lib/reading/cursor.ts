export interface Cursor {
  publishedAt: Date;
  id: string;
}

export function encodeCursor({ publishedAt, id }: Cursor): string {
  return Buffer.from(`${publishedAt.toISOString()}|${id}`).toString('base64url');
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  const [iso, id, ...rest] = Buffer.from(raw, 'base64url').toString().split('|');
  const publishedAt = new Date(iso);
  if (!id || rest.length || Number.isNaN(publishedAt.getTime())) return null;
  return { publishedAt, id };
}
