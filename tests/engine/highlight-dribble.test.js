import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld } from '../../src/engine/highlight/highlight.js';

const attrs = (o = {}) => ({ pace: 60, physical: 60, dribbling: 60, defending: 60, passing: 60, shooting: 60, goalkeeping: 20, ...o });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function world({ defender, seed = 1, carrier = attrs() } = {}) {
  const agents = [{ id: 'atk', side: 'home', x: 0, y: 0, attrs: carrier }];
  if (defender) agents.push({ id: 'def', side: 'away', x: 6, y: 0, attrs: defender });
  return createWorld({ agents, carrierId: 'atk', attackDir: 1, seed });
}
const steps = (w, n, input) => { for (let i = 0; i < n; i++) stepWorld(w, i === 0 ? input : null); return w; };

test('conduzir: jogador anda na direção arrastada com a bola no pé', () => {
  const w = world();
  stepWorld(w, { type: 'dribble', dir: { x: 1, y: 0 } });
  for (let i = 0; i < 120; i++) {
    stepWorld(w);
    const atk = w.agents.find((a) => a.id === 'atk');
    assert.ok(dist(w.ball.pos, atk.pos) < 1, 'bola colada no pé');
  }
  const atk = w.agents.find((a) => a.id === 'atk');
  assert.ok(atk.pos.x > 4, `andou ${atk.pos.x}`);
  assert.equal(w.carrierId, 'atk');
  assert.equal(w.status, 'live');
});

test('conduzir fica dentro da zona de controle (círculo verde)', () => {
  const w = world();
  stepWorld(w, { type: 'dribble', dir: { x: 1, y: 0 }, length: 100 });
  steps(w, 60 * 6);
  const atk = w.agents.find((a) => a.id === 'atk');
  assert.ok(dist(atk.pos, { x: 0, y: 0 }) <= w.controlRadius + 0.5);
});

function lostRate(defending, dribbling) {
  let lost = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const w = world({ seed, defender: attrs({ defending }), carrier: attrs({ dribbling }) });
    stepWorld(w, { type: 'dribble', dir: { x: 1, y: 0 } });
    steps(w, 60 * 3);
    if (w.status === 'lost') lost++;
  }
  return lost / 200;
}

test('desarme depende dos atributos: zagueiro bom ganha, ruim perde', () => {
  const strong = lostRate(90, 30);
  const weak = lostRate(30, 90);
  assert.ok(strong > 0.8, `zagueiro bom tomou em ${strong}`);
  assert.ok(weak < 0.4, `zagueiro ruim tomou em ${weak}`);
});

test('mesma semente, mesmo lance', () => {
  const run = () => {
    const w = world({ seed: 5, defender: attrs() });
    stepWorld(w, { type: 'dribble', dir: { x: 1, y: 0.2 } });
    return steps(w, 200);
  };
  assert.deepEqual(run(), run());
});
