import assert from 'node:assert/strict';
import { test } from 'node:test';
import planCategoryMerge from './merge.ts';

const cat = (id: string, name: string, position: number) => ({ id, name, position });

test('reuses same-named categories and appends new ones in guest order', () => {
  const plan = planCategoryMerge(
    [cat('g1', 'Design', 0), cat('g2', 'AI & ML', 1), cat('g3', ' frontend ', 2)],
    [cat('t1', 'Frontend', 0), cat('t2', 'Reading', 4)]
  );
  assert.deepEqual(plan.reuse, { g3: 't1' });
  assert.deepEqual(plan.create, [
    { name: 'Design', position: 5 },
    { name: 'AI & ML', position: 6 },
  ]);
});

test('an empty target account takes the guest categories as-is', () => {
  const plan = planCategoryMerge([cat('g1', 'Design', 0)], []);
  assert.deepEqual(plan, { create: [{ name: 'Design', position: 0 }], reuse: {} });
});
