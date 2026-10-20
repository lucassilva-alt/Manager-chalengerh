import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, advanceMinute, startSecondHalf } from '../../src/engine/match-sim.js';
import { makeTeam } from './helpers.js';

const newMatch = (seed = 1) => createMatch({ home: makeTeam('A', 60), away: makeTeam('B', 60), seed, userSide: null });
const run = (m) => { while (m.phase === 'first' || m.phase === 'second') advanceMinute(m); };

test('partida começa no 1º tempo, minuto 0, 0 a 0', () => {
  const m = newMatch();
  assert.equal(m.phase, 'first');
  assert.equal(m.minute, 0);
  assert.deepEqual(m.score, { home: 0, away: 0 });
  assert.equal(m.events[0].type, 'kickoff');
});

test('1º tempo para no intervalo aos 45', () => {
  const m = newMatch();
  run(m);
  assert.equal(m.phase, 'halftime');
  assert.equal(m.minute, 45);
  assert.equal(m.events.at(-1).type, 'halftime');
});

test('2º tempo vai até 90 e encerra; avançar depois do fim não muda nada', () => {
  const m = newMatch();
  run(m);
  startSecondHalf(m);
  assert.equal(m.phase, 'second');
  run(m);
  assert.equal(m.phase, 'ended');
  assert.equal(m.minute, 90);
  assert.equal(m.events.at(-1).type, 'fulltime');
  const before = JSON.stringify(m);
  advanceMinute(m);
  assert.equal(JSON.stringify(m), before);
});

test('estado da partida é JSON puro (pode ser salvo e restaurado)', () => {
  const m = newMatch();
  advanceMinute(m);
  assert.deepEqual(JSON.parse(JSON.stringify(m)), m);
});
