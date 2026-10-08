import assert from 'node:assert/strict';
import { test } from 'node:test';
import { decodeCursor, encodeCursor } from './cursor.ts';

const publishedAt = new Date('2026-10-08T10:00:00.000Z');

test('encodeCursor and decodeCursor round-trip', () => {
  assert.deepEqual(decodeCursor(encodeCursor({ publishedAt, id: 'item-1' })), {
    publishedAt,
    id: 'item-1',
  });
});

test('cursors with the same date but different ids differ', () => {
  assert.notEqual(encodeCursor({ publishedAt, id: 'a' }), encodeCursor({ publishedAt, id: 'b' }));
});

test('decodeCursor rejects garbage', () => {
  const noSeparator = Buffer.from('2026-10-08T10:00:00.000Z').toString('base64url');
  const badDate = Buffer.from('not-a-date|item-1').toString('base64url');
  ['@@', '', null, undefined, noSeparator, badDate].forEach((raw) =>
    assert.equal(decodeCursor(raw), null, String(raw))
  );
});
