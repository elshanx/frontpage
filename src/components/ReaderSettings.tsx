'use client';

import { useState } from 'react';
import {
  READER_FONTS,
  READER_RANGES,
  type ReaderFont,
  type ReaderPrefs,
  type ReaderRange,
  parseReaderFont,
  parseReaderRange,
  readerStyle,
} from '@/lib/reading/reader-prefs';

const FONT_LABELS: Record<ReaderFont, string> = {
  serif: 'Georgia (serif)',
  sans: 'Inter (sans-serif)',
  hyperlegible: 'Atkinson Hyperlegible',
};

const RANGES: { key: ReaderRange; label: string; format: (value: number) => string }[] = [
  { key: 'readerSize', label: 'Text size', format: (value) => `${value}px` },
  { key: 'readerLeading', label: 'Line spacing', format: (value) => value.toFixed(1) },
  { key: 'readerMeasure', label: 'Line length', format: (value) => `${value} characters` },
];

export default function ReaderSettings({ initial }: { initial: ReaderPrefs }) {
  const [prefs, setPrefs] = useState(initial);

  return (
    <>
      <fieldset className='flex flex-col gap-1'>
        <legend className='mb-2 font-semibold'>Article font</legend>
        {READER_FONTS.map((font) => (
          <label
            key={font}
            htmlFor={`font-${font}`}
            className='flex min-h-11 items-center gap-3 rounded-md px-2 hover:bg-bg-tertiary'
          >
            <input
              id={`font-${font}`}
              type='radio'
              name='readerFont'
              value={font}
              defaultChecked={font === initial.readerFont}
              onChange={(event) =>
                setPrefs({ ...prefs, readerFont: parseReaderFont(event.target.value) })
              }
              className='size-4 accent-accent'
            />
            {FONT_LABELS[font]}
          </label>
        ))}
      </fieldset>
      {RANGES.map(({ key, label, format }) => (
        <div key={key} className='flex flex-col gap-1'>
          <label htmlFor={key} className='flex justify-between font-semibold'>
            {label}
            <output htmlFor={key} className='font-normal text-text-secondary'>
              {format(prefs[key])}
            </output>
          </label>
          <input
            id={key}
            type='range'
            name={key}
            min={READER_RANGES[key].min}
            max={READER_RANGES[key].max}
            step={READER_RANGES[key].step}
            defaultValue={initial[key]}
            onChange={(event) =>
              setPrefs({ ...prefs, [key]: parseReaderRange(key, event.target.value) })
            }
            className='min-h-11 accent-accent'
          />
        </div>
      ))}
      <section
        aria-label='Preview'
        style={readerStyle(prefs)}
        className='rounded-md border border-border bg-surface p-4'
      >
        <p className='reader-content'>
          The best reading experience gets out of the way. Adjust the font, size, spacing and line
          length until a long article feels comfortable, then save.
        </p>
      </section>
    </>
  );
}
