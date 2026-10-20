import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld } from '../../src/engine/highlight/highlight.js';
import { FIELD } from '../../src/engine/highlight/field.js';

const attrs = (o = {}) => ({ pace: 60, physical: 60, dribbling: 60, defending: 40, passing: 60, shooting: 90, goalkeeping: 20, ...o });
const GOAL_X = FIELD.halfLength;

function scene({ goalkeeping = 70, seed = 1, shooterX = GOAL_X - 18 } = {}) {
  return createWorld({
    agents: [
      { id: 's', side: 'home', x: shooterX, y: 0, attrs: attrs() },
      { id: 'gk', side: 'away', role: 'GK', x: GOAL_X - 1, y: 0, attrs: attrs({ goalkeeping }) },
    ],
    carrierId: 's', attackDir: 1, seed,
  });
}
function settle(w, n = 60) { for (let i = 0; i < n; i++) stepWorld(w); return w; }
function shootAt(w, y, { power = 0.6, lift = 0.15 } = {}) {
  const s = w.agents[0];
  stepWorld(w, { type: 'shoot', dir: { x: GOAL_X - s.pos.x, y: y - s.pos.y }, power, lift });
  for (let i = 0; i < 60 * 4 && w.status === 'live'; i++) stepWorld(w);
  return w.status;
}
function rate(n, make, y, opts) {
  const out = { goal: 0, saved: 0, wide: 0, live: 0 };
  for (let seed = 1; seed <= n; seed++) out[shootAt(settle(make(seed)), y, opts)]++;
  return out;
}

test('chute fraco no meio: bom goleiro defende quase sempre', () => {
  const r = rate(100, (seed) => scene({ goalkeeping: 85, seed }), 0, { power: 0.4 });
  assert.ok(r.saved > 80, JSON.stringify(r));
});

test('chute forte no canto: goleiro médio toma bastante gol', () => {
  const r = rate(100, (seed) => scene({ goalkeeping: 55, seed }), 3.2, { power: 1, lift: 0.12 });
  assert.ok(r.goal > 40, JSON.stringify(r));
});

test('goleiro melhor defende mais nos mesmos chutes', () => {
  const good = rate(150, (seed) => scene({ goalkeeping: 90, seed }), 2.4, { power: 0.8 });
  const bad = rate(150, (seed) => scene({ goalkeeping: 35, seed }), 2.4, { power: 0.8 });
  assert.ok(good.saved > bad.saved + 20, `bom ${good.saved} ruim ${bad.saved}`);
});

test('goleiro se posiciona entre a bola e o gol e não sai da área', () => {
  const w = scene({ shooterX: GOAL_X - 30 });
  w.agents[0].pos.y = 15;
  stepWorld(w, { type: 'dribble', dir: { x: 1, y: -0.3 }, length: 5 });
  settle(w, 120);
  const gk = w.agents.find((a) => a.id === 'gk');
  assert.ok(gk.pos.y > 0, 'goleiro anda para o lado da bola');
  assert.ok(GOAL_X - gk.pos.x <= 16.5 && Math.abs(gk.pos.y) <= 20.16, 'dentro da área');
});
