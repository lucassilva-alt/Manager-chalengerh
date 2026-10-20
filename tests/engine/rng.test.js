import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng } from '../../src/engine/rng.js';

const take = (rng, n) => Array.from({ length: n }, () => rng.next());

test('mesma semente gera a mesma sequência', () => {
  assert.deepEqual(take(createRng(42), 20), take(createRng(42), 20));
});

test('sementes diferentes geram sequências diferentes', () => {
  assert.notDeepEqual(take(createRng(1), 20), take(createRng(2), 20));
});

test('next fica em [0, 1)', () => {
  for (const x of take(createRng(7), 10000)) assert.ok(x >= 0 && x < 1);
});

test('int(min, max) fica no intervalo inclusivo e cobre os extremos', () => {
  const rng = createRng(3);
  const seen = new Set(Array.from({ length: 2000 }, () => rng.int(1, 6)));
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5, 6]);
});

test('estado salvo e restaurado continua a mesma sequência (base do "voltar o lance")', () => {
  const rng = createRng(99);
  take(rng, 5);
  const saved = rng.state();
  const a = take(rng, 10);
  rng.restore(saved);
  assert.deepEqual(take(rng, 10), a);
});
