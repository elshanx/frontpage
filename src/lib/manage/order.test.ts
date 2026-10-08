import assert from 'node:assert/strict';
import { test } from 'node:test';
import moveItem from './order.ts';

test('moveItem swaps with the neighbour in the given direction', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 'b', 'up'), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 'b', 'down'), ['a', 'c', 'b']);
});

test('moveItem leaves the order alone at the edges or for unknown ids', () => {
  const ids = ['a', 'b'];
  assert.deepEqual(moveItem(ids, 'a', 'up'), ids);
  assert.deepEqual(moveItem(ids, 'b', 'down'), ids);
  assert.deepEqual(moveItem(ids, 'z', 'up'), ids);
  assert.notEqual(moveItem(ids, 'a', 'up'), ids);
});
