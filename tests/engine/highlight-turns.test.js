// No lance o tempo pausa para o jogador planejar: começa esperando comando,
// anda enquanto a jogada acontece e volta a esperar quando ela se completa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, stepWorld } from '../../src/engine/highlight/highlight.js';

const attrs = () => ({ pace: 60, physical: 60, dribbling: 60, defending: 60, passing: 60, shooting: 60, goalkeeping: 20 });
const world = () => createWorld({
  agents: [
    { id: 'a', side: 'home', x: 0, y: 0, attrs: attrs() },
    { id: 'b', side: 'home', x: 12, y: 0, attrs: attrs() },
  ],
  carrierId: 'a', attackDir: 1, seed: 1,
});

test('lance começa parado esperando o comando', () => {
  const w = world();
  assert.equal(w.awaitingInput, true);
  const t = w.t;
  stepWorld(w);
  assert.equal(w.t, t, 'sem comando o tempo não anda');
});

test('conduzir solta o tempo; ao chegar no ponto, volta a esperar', () => {
  const w = world();
  stepWorld(w, { type: 'dribble', dir: { x: 1, y: 0 }, length: 4 });
  assert.equal(w.awaitingInput, false);
  for (let i = 0; i < 60 * 4 && !w.awaitingInput; i++) stepWorld(w);
  assert.equal(w.awaitingInput, true);
  assert.ok(w.agents[0].pos.x > 3);
});

test('passe solta o tempo; quando o companheiro domina, volta a esperar', () => {
  const w = world();
  stepWorld(w, { type: 'pass', to: 'b' });
  assert.equal(w.awaitingInput, false);
  for (let i = 0; i < 60 * 4 && !w.awaitingInput; i++) stepWorld(w);
  assert.equal(w.carrierId, 'b');
  assert.equal(w.awaitingInput, true);
});

test('chute solta o tempo até o fim do lance', () => {
  const w = world();
  stepWorld(w, { type: 'shoot', dir: { x: 1, y: 0 }, power: 0.8 });
  assert.equal(w.awaitingInput, false);
});
