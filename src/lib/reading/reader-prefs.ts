import type { CSSProperties } from 'react';

export const READER_FONTS = ['serif', 'sans', 'hyperlegible'] as const;
export type ReaderFont = (typeof READER_FONTS)[number];

export const READER_RANGES = {
  readerSize: { min: 16, max: 24, step: 1, fallback: 18 },
  readerLeading: { min: 1.4, max: 2, step: 0.1, fallback: 1.7 },
  readerMeasure: { min: 55, max: 80, step: 1, fallback: 68 },
} as const;
export type ReaderRange = keyof typeof READER_RANGES;

export interface ReaderPrefs {
  readerFont: ReaderFont;
  readerSize: number;
  readerLeading: number;
  readerMeasure: number;
}

export const parseReaderFont = (raw: unknown): ReaderFont =>
  READER_FONTS.find((font) => font === raw) ?? 'serif';

export function parseReaderRange(key: ReaderRange, raw: unknown): number {
  const { min, max, step, fallback } = READER_RANGES[key];
  const value = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const snapped = Math.round(value / step) * step;
  return Number(Math.min(max, Math.max(min, snapped)).toFixed(1));
}

const FONT_STACKS: Record<ReaderFont, string> = {
  serif: 'Georgia, Charter, serif',
  sans: 'var(--font-inter), system-ui, sans-serif',
  hyperlegible: 'var(--font-hyperlegible), system-ui, sans-serif',
};

export const readerStyle = (prefs: ReaderPrefs) =>
  ({
    '--reader-font': FONT_STACKS[prefs.readerFont],
    '--reader-size': `${prefs.readerSize}px`,
    '--reader-leading': String(prefs.readerLeading),
    '--reader-measure': `${prefs.readerMeasure}ch`,
  }) as CSSProperties;
