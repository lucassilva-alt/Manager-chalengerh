import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, advanceMinute, startSecondHalf } from '../../src/engine/match-sim.js';
import { buildScenario, finishHighlight, outcomeOf } from '../../src/engine/highlight/scenario.js';
import { stepWorld } from '../../src/engine/highlight/highlight.js';
import { FIELD } from '../../src/engine/highlight/field.js';
import { makeTeam } from './helpers.js';

function pendingMatch(seed = 1, userSide = 'home') {
  const m = createMatch({ home: makeTeam('A', 65), away: makeTeam('B', 65), seed, userSide, interactive: true });
  while (!m.pending && m.phase !== 'ended') {
    if (m.phase === 'halftime') startSecondHalf(m); else advanceMinute(m);
  }
  assert.ok(m.pending);
  return m;
}

test('cenário tem os 22 jogadores dentro do campo e o autor da chance com a bola', () => {
  const m = pendingMatch();
  const w = buildScenario(m, { seed: 1 });
  assert.equal(w.agents.length, 22);
  assert.equal(w.carrierId, m.pending.playerId);
  assert.equal(w.attackingSide, m.userSide);
  for (const a of w.agents) {
    assert.ok(Math.abs(a.pos.x) <= FIELD.halfLength && Math.abs(a.pos.y) <= FIELD.halfWidth, a.id);
  }
  const keepers = w.agents.filter((a) => a.role === 'GK');
  assert.equal(keepers.length, 2);
});

test('usa a energia da partida e os atacantes têm corrida (linha tracejada)', () => {
  const m = pendingMatch(3);
  const anyId = m.home.lineup[9].id;
  m.energy[anyId] = 42;
  const w = buildScenario(m, { seed: 1 });
  assert.equal(w.agents.find((a) => a.id === anyId).energy, 42);
  const runners = w.agents.filter((a) => a.side === w.attackingSide && a.id !== w.carrierId && a.path.length);
  assert.ok(runners.length >= 2);
});

test('funciona quando o jogador é o visitante', () => {
  const m = pendingMatch(4, 'away');
  const w = buildScenario(m, { seed: 1 });
  assert.equal(w.attackingSide, 'away');
  assert.ok(m.away.lineup.some((p) => p.id === w.carrierId));
});

test('desfecho do lance volta para a partida', () => {
  const m = pendingMatch(5);
  const w = buildScenario(m, { seed: 1 });
  w.status = 'goal';
  finishHighlight(m, w);
  assert.equal(m.pending, null);
  assert.equal(m.score[m.userSide], 1);
});

test('perder a bola ou esgotar o tempo não vale gol', () => {
  assert.equal(outcomeOf({ status: 'lost' }), 'wide');
  assert.equal(outcomeOf({ status: 'timeout' }), 'wide');
  assert.equal(outcomeOf({ status: 'saved' }), 'saved');
  assert.equal(outcomeOf({ status: 'goal' }), 'goal');
});

test('lance sem ação acaba por tempo esgotado', () => {
  const m = pendingMatch(6);
  const w = buildScenario(m, { seed: 1, defendersIdle: true, turnBased: false });
  for (let i = 0; i < 60 * 40 && w.status === 'live'; i++) stepWorld(w);
  assert.equal(w.status, 'timeout');
});

// Equilíbrio: jogadas simples precisam dar gol numa faixa jogável
// (a simulação automática converte ~24% das chances).
function strategyGoalRate(play) {
  let goals = 0, total = 0;
  for (let seed = 1; seed <= 300 && total < 200; seed++) {
    const m = createMatch({ home: makeTeam('A', 65), away: makeTeam('B', 65), seed, userSide: 'home', interactive: true });
    while (!m.pending && m.phase !== 'ended') { if (m.phase === 'halftime') startSecondHalf(m); else advanceMinute(m); }
    if (!m.pending) continue;
    const w = buildScenario(m, { seed });
    play(w);
    for (let i = 0; i < 60 * 10 && w.status === 'live'; i++) stepWorld(w);
    total++;
    if (w.status === 'goal') goals++;
  }
  return goals / total;
}
const carrier = (w) => w.agents.find((a) => a.id === w.carrierId);
const shootCorner = (w) => {
  const c = carrier(w);
  stepWorld(w, { type: 'shoot', dir: { x: FIELD.halfLength - c.pos.x, y: 3 - c.pos.y }, power: 0.9, lift: 0.15 });
};

test('equilíbrio: conduzir e chutar no canto dá gol entre 15% e 45%', () => {
  const rate = strategyGoalRate((w) => {
    stepWorld(w, { type: 'dribble', dir: { x: 1, y: 0.3 } });
    for (let i = 0; i < 60 && w.status === 'live'; i++) stepWorld(w);
    if (w.status === 'live' && w.carrierId) shootCorner(w);
  });
  assert.ok(rate >= 0.15 && rate <= 0.45, `taxa ${rate}`);
});

test('equilíbrio: chute de longe é mais difícil que conduzir antes', () => {
  const longShot = strategyGoalRate(shootCorner);
  const dribbled = strategyGoalRate((w) => {
    stepWorld(w, { type: 'dribble', dir: { x: 1, y: 0.3 } });
    for (let i = 0; i < 60 && w.status === 'live'; i++) stepWorld(w);
    if (w.status === 'live' && w.carrierId) shootCorner(w);
  });
  assert.ok(longShot < dribbled, `longe ${longShot} conduzindo ${dribbled}`);
});
