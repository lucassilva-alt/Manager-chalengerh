import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createMatch, advanceMinute, startSecondHalf, resolveHighlight, simulateHighlight,
} from '../../src/engine/match-sim.js';
import { makeTeam } from './helpers.js';

const newMatch = (seed, opts = {}) =>
  createMatch({ home: makeTeam('A', 65), away: makeTeam('B', 65), seed, userSide: 'home', interactive: true, ...opts });

function untilPending(m) {
  while (m.phase !== 'ended' && !m.pending) {
    if (m.phase === 'halftime') startSecondHalf(m); else advanceMinute(m);
  }
  return m;
}

test('chance do time do jogador pausa a partida com pedido de lance', () => {
  const m = untilPending(newMatch(1));
  assert.ok(m.pending, 'deveria ter lance pendente');
  assert.equal(m.pending.side, 'home');
  assert.ok(m.home.lineup.some((p) => p.id === m.pending.playerId));
  assert.equal(m.events.at(-1).type, 'highlight');
  const minute = m.minute;
  advanceMinute(m);
  assert.equal(m.minute, minute, 'relógio parado enquanto o lance está pendente');
});

test('resolver o lance com gol muda placar, registra autor e libera o relógio', () => {
  const m = untilPending(newMatch(2));
  const { playerId } = m.pending;
  resolveHighlight(m, { outcome: 'goal' });
  assert.equal(m.pending, null);
  assert.equal(m.score.home, 1);
  assert.deepEqual(m.events.at(-1), { minute: m.minute, type: 'goal', kind: m.events.at(-2).kind, side: 'home', playerId });
  assert.ok(m.ratings[playerId] > 6.5);
  const minute = m.minute;
  advanceMinute(m);
  assert.equal(m.minute, minute + 1);
});

test('resolver sem gol não muda o placar', () => {
  const m = untilPending(newMatch(3));
  resolveHighlight(m, { outcome: 'saved' });
  assert.equal(m.score.home, 0);
  assert.equal(m.pending, null);
});

test('modo não interativo nunca pausa', () => {
  const m = untilPending(newMatch(4, { interactive: false }));
  assert.equal(m.phase, 'ended');
  assert.equal(m.pending ?? null, null);
});

test('simular os lances dá resultado coerente com a simulação automática', () => {
  let interactive = 0, automatic = 0;
  for (let seed = 1; seed <= 500; seed++) {
    const a = newMatch(seed);
    while (a.phase !== 'ended') {
      if (a.pending) simulateHighlight(a);
      else if (a.phase === 'halftime') startSecondHalf(a);
      else advanceMinute(a);
    }
    interactive += a.score.home;
    const b = untilPending(newMatch(seed, { interactive: false }));
    automatic += b.score.home;
  }
  const ratio = interactive / automatic;
  assert.ok(ratio > 0.85 && ratio < 1.15, `interativo ${interactive} automático ${automatic}`);
});
