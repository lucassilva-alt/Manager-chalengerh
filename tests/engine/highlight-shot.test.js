import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld } from '../../src/engine/highlight/highlight.js';
import { FIELD } from '../../src/engine/highlight/field.js';

const attrs = (o = {}) => ({ pace: 60, physical: 60, dribbling: 60, defending: 60, passing: 60, shooting: 100, goalkeeping: 20, ...o });
const GOAL_X = FIELD.halfLength;

function shooter({ x = GOAL_X - 20, y = 0, shooting = 100, seed = 1 } = {}) {
  return createWorld({
    agents: [{ id: 's', side: 'home', x, y, attrs: attrs({ shooting }) }],
    carrierId: 's', attackDir: 1, seed,
  });
}
function shoot(w, aim, { power = 0.7, curl = 0, lift = 0.2 } = {}) {
  const s = w.agents[0];
  stepWorld(w, { type: 'shoot', dir: { x: aim.x - s.pos.x, y: aim.y - s.pos.y }, power, curl, lift });
  for (let i = 0; i < 60 * 4 && w.status === 'live'; i++) stepWorld(w);
  return w;
}

test('chute no meio do gol, sem goleiro, é gol', () => {
  assert.equal(shoot(shooter(), { x: GOAL_X, y: 0 }).status, 'goal');
});

test('chute para fora do gol termina como fora', () => {
  assert.equal(shoot(shooter(), { x: GOAL_X, y: 10 }).status, 'wide');
});

test('chute forte e alto demais passa por cima', () => {
  assert.equal(shoot(shooter(), { x: GOAL_X, y: 0 }, { power: 1, lift: 1 }).status, 'wide');
});

test('bola na trave é registrada e não vale gol naquele instante', () => {
  const w = shooter();
  shoot(w, { x: GOAL_X, y: FIELD.goalHalfWidth + 0.05 }, { power: 0.6, lift: 0.1 });
  assert.ok(w.events.some((e) => e.type === 'post'), 'deveria registrar a trave');
});

test('efeito curva o chute', () => {
  const straight = shooter(), curled = shooter();
  shoot(straight, { x: GOAL_X, y: 0 });
  shoot(curled, { x: GOAL_X, y: 0 }, { curl: 1 });
  assert.notEqual(Math.round(straight.ball.pos.y * 10), Math.round(curled.ball.pos.y * 10));
});

test('distância do chute fica registrada em metros', () => {
  const w = shoot(shooter({ x: GOAL_X - 27, y: 0 }), { x: GOAL_X, y: 0 });
  assert.equal(w.lastKick.type, 'shot');
  assert.equal(w.lastKick.distance.toFixed(1), '27.0');
});

test('finalizador ruim erra mais a mira que o bom', () => {
  const wideRate = (shooting) => {
    let wide = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const w = shoot(shooter({ shooting, seed, x: GOAL_X - 25 }), { x: GOAL_X, y: 2.5 }, { power: 0.9 });
      if (w.status === 'wide') wide++;
    }
    return wide;
  };
  assert.ok(wideRate(30) > wideRate(95) + 30);
});
