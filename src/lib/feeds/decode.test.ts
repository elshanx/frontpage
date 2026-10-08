import assert from 'node:assert/strict';
import { test } from 'node:test';
import decodeFeed from './decode.ts';

const bytes = (...values: number[]) => Uint8Array.from(values);
const ascii = (text: string) => [...Buffer.from(text, 'latin1')];

test('decodes UTF-8 by default', () => {
  assert.equal(decodeFeed(new TextEncoder().encode('<t>café ’</t>'), null), '<t>café ’</t>');
});

test('uses the charset from the Content-Type header', () => {
  const latin1 = bytes(...ascii('<t>caf'), 0xe9, ...ascii('</t>'));
  assert.equal(decodeFeed(latin1, 'application/rss+xml; charset=ISO-8859-1'), '<t>café</t>');
});

test('uses the encoding from the XML declaration', () => {
  const win1252 = bytes(
    ...ascii('<?xml version="1.0" encoding="windows-1252"?><t>it'),
    0x92,
    ...ascii('s</t>')
  );
  assert.match(decodeFeed(win1252, 'text/xml'), /<t>it’s<\/t>/);
});

test('falls back to Windows-1252 when bytes labelled UTF-8 are invalid', () => {
  const mislabeled = bytes(...ascii('<t>caf'), 0xe9, 0x20, 0x92, ...ascii('</t>'));
  assert.equal(decodeFeed(mislabeled, 'text/xml; charset=utf-8'), '<t>café ’</t>');
});

test('prefers valid UTF-8 over a single-byte label', () => {
  const utf8 = new TextEncoder().encode('<t>it’s café</t>');
  assert.equal(decodeFeed(utf8, 'text/xml; charset=ISO-8859-1'), '<t>it’s café</t>');
});

test('ignores unknown charset labels', () => {
  assert.equal(
    decodeFeed(new TextEncoder().encode('<t>ok</t>'), 'text/xml; charset=x-bogus'),
    '<t>ok</t>'
  );
});

test('honours UTF-16 byte order marks', () => {
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('<t>é</t>', 'utf16le')]);
  assert.equal(decodeFeed(utf16, null), '<t>é</t>');
});
