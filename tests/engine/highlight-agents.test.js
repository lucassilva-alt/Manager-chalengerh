import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAgent, stepAgent, maxSpeed } from '../../src/engine/highlight/agents.js';
import { DT } from '../../src/engine/highlight/physics.js';

const attrs = (pace = 60, physical = 60) => ({ pace, physical });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function timeTo(agent, target, limit = 20) {
  agent.target = target;
  let t = 0;
  while (dist(agent.pos, target) > 0.3 && t < limit) { stepAgent(agent); t += DT; }
  return t;
}

test('jogador chega ao alvo e para perto dele', () => {
  const a = createAgent({ id: 'p', side: 'home', x: 0, y: 0, attrs: attrs() });
  const t = timeTo(a, { x: 20, y: 0 });
  assert.ok(t < 20);
  for (let i = 0; i < 120; i++) stepAgent(a);
  assert.ok(dist(a.pos, { x: 20, y: 0 }) < 0.5);
  assert.ok(Math.hypot(a.vel.x, a.vel.y) < 0.5);
});

test('quem tem mais ritmo (pace) chega antes', () => {
  const fast = createAgent({ id: 'f', side: 'home', x: 0, y: 0, attrs: attrs(90) });
  const slow = createAgent({ id: 's', side: 'home', x: 0, y: 0, attrs: attrs(40) });
  assert.ok(timeTo(fast, { x: 30, y: 0 }) < timeTo(slow, { x: 30, y: 0 }));
});

test('aceleração limitada: não sai do zero para a velocidade máxima num passo', () => {
  const a = createAgent({ id: 'p', side: 'home', x: 0, y: 0, attrs: attrs(99, 99) });
  a.target = { x: 50, y: 0 };
  stepAgent(a);
  assert.ok(Math.hypot(a.vel.x, a.vel.y) < maxSpeed(a) / 4);
});

test('segue o caminho (corrida) ponto a ponto, na ordem', () => {
  const a = createAgent({ id: 'p', side: 'home', x: 0, y: 0, attrs: attrs() });
  a.path = [{ x: 10, y: 0 }, { x: 10, y: 10 }];
  let passedFirst = false;
  for (let i = 0; i < 60 * 15 && a.path.length + (a.target ? 1 : 0) > 0; i++) {
    stepAgent(a);
    if (dist(a.pos, { x: 10, y: 0 }) < 0.5) passedFirst = true;
  }
  assert.ok(passedFirst);
  assert.ok(dist(a.pos, { x: 10, y: 10 }) < 0.6);
});

test('energia baixa reduz a velocidade máxima', () => {
  const fresh = createAgent({ id: 'a', side: 'home', x: 0, y: 0, attrs: attrs(), energy: 100 });
  const tired = createAgent({ id: 'b', side: 'home', x: 0, y: 0, attrs: attrs(), energy: 30 });
  assert.ok(maxSpeed(tired) < maxSpeed(fresh));
});
