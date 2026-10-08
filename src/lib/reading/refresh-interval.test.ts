import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_REFRESH_MINUTES, parseRefreshMinutes } from './refresh-interval.ts';

test('parseRefreshMinutes accepts the offered intervals as strings or numbers', () => {
  assert.equal(parseRefreshMinutes('15'), 15);
  assert.equal(parseRefreshMinutes(30), 30);
  assert.equal(parseRefreshMinutes('60'), 60);
  assert.equal(parseRefreshMinutes('0'), 0);
  assert.equal(DEFAULT_REFRESH_MINUTES, 30);
});

test('parseRefreshMinutes rejects anything else', () => {
  ['45', '', 'abc', -1, '15.5', null, undefined, ' 15'].forEach((raw) => {
    assert.equal(parseRefreshMinutes(raw), null, String(raw));
  });
});
