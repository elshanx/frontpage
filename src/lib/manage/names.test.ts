import assert from 'node:assert/strict';
import { test } from 'node:test';
import parseCategoryName from './names.ts';

test('parseCategoryName trims and collapses whitespace', () => {
  assert.equal(parseCategoryName('  Front   end '), 'Front end');
  assert.equal(parseCategoryName('x'.repeat(40)), 'x'.repeat(40));
});

test('parseCategoryName rejects empty, too long and non-string input', () => {
  [' ', '', 'x'.repeat(41), null, 5].forEach((raw) => assert.equal(parseCategoryName(raw), null));
});
