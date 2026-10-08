import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseReaderFont, parseReaderRange, readerStyle } from './reader-prefs.ts';

test('parseReaderFont falls back to serif', () => {
  assert.equal(parseReaderFont('hyperlegible'), 'hyperlegible');
  assert.equal(parseReaderFont('comic-sans'), 'serif');
  assert.equal(parseReaderFont(undefined), 'serif');
});

test('parseReaderRange clamps, snaps and falls back', () => {
  assert.equal(parseReaderRange('readerSize', '20'), 20);
  assert.equal(parseReaderRange('readerSize', '99'), 24);
  assert.equal(parseReaderRange('readerSize', 3), 16);
  assert.equal(parseReaderRange('readerSize', ''), 18);
  assert.equal(parseReaderRange('readerSize', 'abc'), 18);
  assert.equal(parseReaderRange('readerLeading', '1.73'), 1.7);
  assert.equal(parseReaderRange('readerLeading', 5), 2);
  assert.equal(parseReaderRange('readerMeasure', null), 68);
});

test('readerStyle emits CSS custom properties', () => {
  assert.deepEqual(
    readerStyle({ readerFont: 'serif', readerSize: 20, readerLeading: 1.8, readerMeasure: 70 }),
    {
      '--reader-font': 'Georgia, Charter, serif',
      '--reader-size': '20px',
      '--reader-leading': '1.8',
      '--reader-measure': '70ch',
    }
  );
});
