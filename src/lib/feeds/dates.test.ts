import assert from 'node:assert/strict';
import { test } from 'node:test';
import parseDate from './dates.ts';

const iso = (raw: string | null | undefined) => parseDate(raw)?.toISOString() ?? null;

test('parses ISO 8601 with Z and offsets', () => {
  assert.equal(iso('2024-01-15T10:30:00Z'), '2024-01-15T10:30:00.000Z');
  assert.equal(iso('2024-01-15T10:30:00+02:00'), '2024-01-15T08:30:00.000Z');
});

test('treats ISO-like dates without a zone as UTC', () => {
  assert.equal(iso('2024-01-15 10:30:00'), '2024-01-15T10:30:00.000Z');
  assert.equal(iso('2024-01-15T10:30'), '2024-01-15T10:30:00.000Z');
  assert.equal(iso('2024-01-15'), '2024-01-15T00:00:00.000Z');
});

test('parses RFC 822 / 2822 variants', () => {
  assert.equal(iso('Mon, 15 Jan 2024 10:30:00 GMT'), '2024-01-15T10:30:00.000Z');
  assert.equal(iso('Mon, 15 Jan 2024 10:30:00 -0500'), '2024-01-15T15:30:00.000Z');
  assert.equal(iso('Mon, 15 Jan 2024 10:30:00 EST'), '2024-01-15T15:30:00.000Z');
  assert.equal(iso('15 Jan 2024 10:30:00 GMT'), '2024-01-15T10:30:00.000Z');
  assert.equal(iso('Fri, 15 Jan 2024 10:30:00 GMT'), '2024-01-15T10:30:00.000Z');
  assert.equal(iso('Mon,  15 Jan 2024   10:30:00 GMT '), '2024-01-15T10:30:00.000Z');
});

test('maps zone abbreviations JavaScript does not know', () => {
  assert.equal(iso('Tue, 16 Jul 2024 10:30:00 CEST'), '2024-07-16T08:30:00.000Z');
  assert.equal(iso('Tue, 16 Jul 2024 10:30:00 IST'), '2024-07-16T05:00:00.000Z');
});

test('returns null for missing or unusable dates', () => {
  assert.equal(iso(undefined), null);
  assert.equal(iso(null), null);
  assert.equal(iso('   '), null);
  assert.equal(iso('not a date'), null);
  assert.equal(iso('1970-01-01T00:00:00Z'), null);
});
