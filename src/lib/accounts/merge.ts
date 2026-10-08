export interface CategoryRef {
  id: string;
  name: string;
  position: number;
}

export interface CategoryMergePlan {
  create: { name: string; position: number }[];
  reuse: Record<string, string>;
}

const key = (name: string) => name.trim().toLowerCase();

export default function planCategoryMerge(
  guest: CategoryRef[],
  target: CategoryRef[]
): CategoryMergePlan {
  const existing = new Map(target.map(({ id, name }) => [key(name), id]));
  const start = Math.max(-1, ...target.map(({ position }) => position)) + 1;
  const ordered = guest.toSorted((a, b) => a.position - b.position);
  const reuse = Object.fromEntries(
    ordered.flatMap(({ id, name }) => {
      const targetId = existing.get(key(name));
      return targetId ? [[id, targetId]] : [];
    })
  );
  const create = ordered
    .filter(({ name }) => !existing.has(key(name)))
    .map(({ name }, index) => ({ name: name.trim(), position: start + index }));
  return { create, reuse };
}
