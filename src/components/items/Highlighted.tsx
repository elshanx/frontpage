import splitHighlights from '@/lib/search/highlight';

export default function Highlighted({ text }: { text: string }) {
  return splitHighlights(text).map((part, index) =>
    part.match ? (
      // eslint-disable-next-line react/no-array-index-key -- parts are positional and never reorder
      <mark key={index} className='rounded-sm bg-accent-subtle px-0.5 text-text-primary'>
        {part.text}
      </mark>
    ) : (
      part.text
    )
  );
}
