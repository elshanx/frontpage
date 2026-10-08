export default function moveItem(ids: string[], id: string, direction: 'up' | 'down'): string[] {
  const from = ids.indexOf(id);
  const to = direction === 'up' ? from - 1 : from + 1;
  const moved = [...ids];
  if (from === -1 || to < 0 || to >= ids.length) return moved;
  [moved[from], moved[to]] = [moved[to], moved[from]];
  return moved;
}
