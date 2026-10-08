export const MARK_START = '\u0001';
export const MARK_END = '\u0002';

export default function splitHighlights(text: string): { text: string; match: boolean }[] {
  return text
    .split(MARK_START)
    .flatMap((chunk, index) => {
      if (index === 0) return [{ text: chunk, match: false }];
      const [matched, ...rest] = chunk.split(MARK_END);
      return [
        { text: matched, match: true },
        { text: rest.join(''), match: false },
      ];
    })
    .filter((part) => part.text);
}
