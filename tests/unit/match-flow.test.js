import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatchFlow, MINUTE_SECONDS } from '../../src/ui/match-flow.js';
import { makeTeam } from '../engine/helpers.js';

// Por padrão sem lances de defesa: estes testes tratam relógio e ataque.
const newFlow = (seed = 1, opts = {}) =>
  createMatchFlow({ home: makeTeam('A', 65), away: makeTeam('B', 65), seed, userSide: 'home', defend: false, ...opts });

function tickUntil(flow, pred, max = 100000) {
  for (let i = 0; i < max && !pred(flow); i++) flow.tick(MINUTE_SECONDS);
  return flow;
}

test('começa pausado antes do apito; jogar inicia o relógio', () => {
  const f = newFlow();
  assert.equal(f.state, 'ready');
  f.tick(10);
  assert.equal(f.match.minute, 0);
  f.play();
  f.tick(MINUTE_SECONDS * 3);
  assert.equal(f.match.minute, 3);
});

test('acelerar (>>>) avança mais minutos no mesmo tempo', () => {
  const normal = newFlow(); normal.play(); normal.tick(MINUTE_SECONDS * 4);
  const fast = newFlow(); fast.play(); fast.setSpeed(4); fast.tick(MINUTE_SECONDS * 4);
  assert.ok(fast.match.minute > normal.match.minute);
});

test('pausar congela o relógio', () => {
  const f = newFlow(); f.play(); f.tick(MINUTE_SECONDS * 2);
  f.pause(); f.tick(MINUTE_SECONDS * 10);
  assert.equal(f.match.minute, 2);
  assert.equal(f.state, 'paused');
});

test('chance do jogador abre o lance; fim do lance mostra o resultado; continuar volta a correr', () => {
  const f = newFlow(1); f.play();
  tickUntil(f, (x) => x.state === 'highlight');
  assert.ok(f.world, 'mundo do lance criado');
  f.world.status = 'goal';
  f.endHighlight();
  assert.equal(f.state, 'highlightResult');
  assert.equal(f.lastOutcome, 'goal');
  f.continueAfterHighlight();
  assert.equal(f.state, 'running');
  assert.equal(f.match.score.home, 1);
});

test('voltar o lance recomeça do início uma única vez', () => {
  const f = newFlow(2); f.play();
  tickUntil(f, (x) => x.state === 'highlight');
  const start = structuredClone(f.world);
  f.world.status = 'saved';
  f.endHighlight();
  assert.equal(f.canRewind, true);
  f.rewind();
  assert.equal(f.state, 'highlight');
  assert.deepEqual(f.world, start);
  f.world.status = 'wide';
  f.endHighlight();
  assert.equal(f.canRewind, false);
});

test('simular o lance resolve sem jogar', () => {
  const f = newFlow(3); f.play();
  tickUntil(f, (x) => x.state === 'highlight');
  f.skipHighlight();
  assert.equal(f.state, 'running');
  assert.equal(f.match.pending, null);
});

test('intervalo pausa até começar o 2º tempo', () => {
  const f = newFlow(4, { interactive: false }); f.play();
  tickUntil(f, (x) => x.state === 'halftime');
  assert.equal(f.match.minute, 45);
  f.tick(MINUTE_SECONDS * 5);
  assert.equal(f.match.minute, 45);
  f.startSecondHalf();
  f.tick(MINUTE_SECONDS);
  assert.equal(f.match.minute, 46);
});

test('simular partida vai até o fim sem abrir lances', () => {
  const f = newFlow(5); f.play();
  f.simulateRest();
  assert.equal(f.state, 'ended');
  assert.equal(f.match.phase, 'ended');
});

test('relógio exibido em mm:ss acompanha o minuto e a fração', () => {
  const f = newFlow(6, { interactive: false }); f.play();
  f.tick(MINUTE_SECONDS * 12.5);
  assert.equal(f.clock(), '12:30');
});

test('lance de defesa: gol sofrido conta para o adversário', () => {
  const f = newFlow(1, { defend: true }); f.play();
  for (let i = 0; i < 5000 && f.state !== 'ended'; i++) {
    f.tick(MINUTE_SECONDS);
    if (f.state === 'halftime') f.startSecondHalf();
    if (f.state === 'highlight') {
      if (f.world.mode === 'defense') break;
      f.skipHighlight();
    }
  }
  assert.equal(f.world.mode, 'defense');
  const before = { ...f.match.score };
  f.world.status = 'goal';
  f.endHighlight();
  f.continueAfterHighlight();
  assert.equal(f.match.score.away, before.away + 1);
  assert.equal(f.match.score.home, before.home);
});
