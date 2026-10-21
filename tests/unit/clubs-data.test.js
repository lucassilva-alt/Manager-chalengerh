// E2: cadastro de clubes reais — completo, com fonte e escudo que existe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile('data/clubs-2026.json', 'utf8'));
const { crests } = JSON.parse(await readFile('assets/crests/br/index.json', 'utf8'));

test('20 clubes na Série A e 20 na Série B, cada lista com fonte', () => {
  assert.equal(data.lists.serieA.clubs.length, 20);
  assert.equal(data.lists.serieB.clubs.length, 20);
  assert.match(data.lists.serieA.source, /^https:\/\//);
  assert.match(data.lists.serieB.source, /^https:\/\//);
  const ids = new Set(data.clubs.map((c) => c.id));
  for (const id of [...data.lists.serieA.clubs, ...data.lists.serieB.clubs]) assert.ok(ids.has(id), id);
});

test('cada clube: campos preenchidos, cores hex, escudo existente, fonte', () => {
  for (const c of data.clubs) {
    for (const k of ['id', 'name', 'fullName', 'short', 'city', 'state', 'stadium']) assert.ok(c[k], `${c.id}.${k}`);
    assert.match(c.short, /^[A-Z]{3}$/, c.id);
    assert.ok(Number.isInteger(c.capacity) && c.capacity > 1000, `${c.id} capacidade`);
    assert.match(c.colors.shirt, /^#[0-9a-f]{6}$/i, c.id);
    assert.match(c.colors.shorts, /^#[0-9a-f]{6}$/i, c.id);
    assert.ok(crests[c.crest], `${c.id} escudo ${c.crest}`);
    assert.ok(c.sources.length >= 1 && c.sources.every((s) => s.startsWith('https://')), `${c.id} fonte`);
    assert.ok(['A', 'B'].includes(c.division));
  }
});

test('ids e siglas não se repetem', () => {
  assert.equal(new Set(data.clubs.map((c) => c.id)).size, data.clubs.length);
  assert.equal(new Set(data.clubs.map((c) => c.short)).size, data.clubs.length);
});
