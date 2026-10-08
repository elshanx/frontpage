import assert from 'node:assert/strict';
import { test } from 'node:test';
import splitHighlights, { MARK_END, MARK_START } from './highlight.ts';
import { parseSearchParams, toTsQuery } from './query.ts';

test('toTsQuery joins word tokens and prefix-matches the last one', () => {
  assert.equal(toTsQuery('css grid lay'), 'css & grid & lay:*');
  assert.equal(toTsQuery("a' | b:* & !"), 'a & b:*');
  assert.equal(toTsQuery('Café'), 'café:*');
  assert.equal(toTsQuery('  '), null);
  assert.equal(toTsQuery('!!! ---'), null);
  assert.equal(toTsQuery('1 2 3 4 5 6 7 8 9 10'), '1 & 2 & 3 & 4 & 5 & 6 & 7 & 8:*');
});

test('parseSearchParams validates ids and dates', () => {
  assert.deepEqual(parseSearchParams({}), {
    q: '',
    feedId: null,
    categoryId: null,
    from: null,
    to: null,
  });
  const parsed = parseSearchParams({
    q: [' grid ', 'x'],
    feed: 'abc-1',
    category: '../etc',
    from: '2026-01-02',
    to: '2026-01-03',
  });
  assert.equal(parsed.q, 'grid');
  assert.equal(parsed.feedId, 'abc-1');
  assert.equal(parsed.categoryId, null);
  assert.equal(parsed.from?.toISOString(), '2026-01-02T00:00:00.000Z');
  assert.equal(parsed.to?.toISOString(), '2026-01-03T23:59:59.999Z');
  assert.equal(parseSearchParams({ from: '2026-13-40' }).from, null);
});

test('splitHighlights turns sentinel markers into match segments', () => {
  assert.deepEqual(splitHighlights(`a ${MARK_START}css${MARK_END} b`), [
    { text: 'a ', match: false },
    { text: 'css', match: true },
    { text: ' b', match: false },
  ]);
  assert.deepEqual(splitHighlights('plain'), [{ text: 'plain', match: false }]);
  assert.deepEqual(splitHighlights(`x${MARK_START}y`), [
    { text: 'x', match: false },
    { text: 'y', match: true },
  ]);
});
