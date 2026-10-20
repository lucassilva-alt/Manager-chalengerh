import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, advanceMinute, startSecondHalf } from '../../src/engine/match-sim.js';
import { makeTeam } from './helpers.js';

function play(home, away, seed) {
  const m = createMatch({ home, away, seed, userSide: null });
  while (m.phase !== 'ended') {
    if (m.phase === 'halftime') startSecondHalf(m);
    else advanceMinute(m);
  }
  return m;
}

test('em 1.000 partidas o time mais forte vence bem mais', () => {
  const strong = makeTeam('Forte', 80), weak = makeTeam('Fraco', 50);
  let strongWins = 0, weakWins = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const { score } = play(strong, weak, seed);
    if (score.home > score.away) strongWins++;
    if (score.home < score.away) weakWins++;
  }
  assert.ok(strongWins > 600, `forte venceu ${strongWins}`);
  assert.ok(weakWins < 200, `fraco venceu ${weakWins}`);
});

test('times iguais: média de gols por partida entre 2 e 3,5', () => {
  let goals = 0;
  for (let seed = 1; seed <= 1000; seed++) {
    const { score } = play(makeTeam('A', 65), makeTeam('B', 65), seed);
    goals += score.home + score.away;
  }
  const avg = goals / 1000;
  assert.ok(avg >= 2 && avg <= 3.5, `média ${avg}`);
});

test('mesma semente gera a mesma partida', () => {
  const a = play(makeTeam('A', 60), makeTeam('B', 60), 77);
  const b = play(makeTeam('A', 60), makeTeam('B', 60), 77);
  assert.deepEqual(a.events, b.events);
});

test('placar bate com os gols e cada gol tem autor do time certo', () => {
  const home = makeTeam('A', 70), away = makeTeam('B', 60);
  for (let seed = 1; seed <= 50; seed++) {
    const m = play(home, away, seed);
    const goals = m.events.filter((e) => e.type === 'goal');
    assert.equal(goals.filter((g) => g.side === 'home').length, m.score.home);
    assert.equal(goals.filter((g) => g.side === 'away').length, m.score.away);
    for (const g of goals) assert.ok(m[g.side].lineup.some((p) => p.id === g.playerId));
  }
});

test('partida tem lances além de gols (chances, escanteios, faltas)', () => {
  const m = play(makeTeam('A', 65), makeTeam('B', 65), 5);
  const types = new Set(m.events.map((e) => e.type));
  assert.ok(types.has('chance'));
  assert.ok(types.has('corner') || types.has('freekick'));
});
