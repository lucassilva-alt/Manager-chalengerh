import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld } from '../../src/engine/highlight/highlight.js';

const attrs = (o = {}) => ({ pace: 60, physical: 60, dribbling: 60, defending: 60, passing: 60, shooting: 60, goalkeeping: 20, ...o });

function world({ defenderAt, defending = 60, passing = 60, seed = 1 } = {}) {
  const agents = [
    { id: 'a', side: 'home', x: 0, y: 0, attrs: attrs({ passing }) },
    { id: 'b', side: 'home', x: 15, y: 0, attrs: attrs() },
  ];
  if (defenderAt) agents.push({ id: 'd', side: 'away', ...defenderAt, attrs: attrs({ defending }) });
  return createWorld({ agents, carrierId: 'a', attackDir: 1, seed, defendersIdle: true });
}
function untilSettled(w, max = 4) {
  for (let i = 0; i < max * 60; i++) {
    stepWorld(w);
    if (w.status !== 'live' || w.carrierId) break;
  }
  return w;
}

test('passe livre chega no companheiro e a posse passa para ele', () => {
  const w = world();
  stepWorld(w, { type: 'pass', to: 'b' });
  assert.equal(w.carrierId, null, 'bola sai do pé');
  untilSettled(w);
  assert.equal(w.status, 'live');
  assert.equal(w.carrierId, 'b');
});

test('defensor no meio da linha do passe intercepta quase sempre', () => {
  let lost = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const w = world({ defenderAt: { x: 7, y: 0 }, defending: 85, seed });
    stepWorld(w, { type: 'pass', to: 'b' });
    untilSettled(w);
    if (w.status === 'lost') lost++;
  }
  assert.ok(lost > 70, `interceptou ${lost}/100`);
});

test('defensor longe da linha não intercepta', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const w = world({ defenderAt: { x: 7, y: 12 }, defending: 99, seed });
    stepWorld(w, { type: 'pass', to: 'b' });
    untilSettled(w);
    assert.equal(w.carrierId, 'b');
  }
});

test('passe ruim erra mais a direção que passe bom', () => {
  const meanError = (passing) => {
    let sum = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const w = world({ passing, seed });
      stepWorld(w, { type: 'pass', to: 'b' });
      sum += Math.abs(w.lastKick.error);
    }
    return sum / 200;
  };
  assert.ok(meanError(30) > meanError(90) * 2);
});

test('passe só sai do jogador com a bola', () => {
  const w = world();
  stepWorld(w, { type: 'pass', to: 'a' });
  assert.equal(w.carrierId, 'a', 'passe para si mesmo é ignorado');
});
