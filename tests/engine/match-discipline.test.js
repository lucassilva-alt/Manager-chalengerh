// B6: cartões e lesões na simulação.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, advanceMinute, startSecondHalf, bookPlayer, matchStrength } from '../../src/engine/match-sim.js';
import { makeTeam } from './helpers.js';

function play(seed) {
  const m = createMatch({ home: makeTeam('A', 65), away: makeTeam('B', 65), seed });
  while (m.phase !== 'ended') {
    if (m.phase === 'halftime') startSecondHalf(m);
    else advanceMinute(m);
  }
  return m;
}
const count = (m, type) => m.events.filter((e) => e.type === type).length;

test('por jogo: ~4–6 amarelos, vermelho raro, lesão de vez em quando', () => {
  let y = 0, r = 0, inj = 0;
  const N = 500;
  for (let seed = 1; seed <= N; seed++) {
    const m = play(seed);
    y += count(m, 'yellow'); r += count(m, 'red'); inj += count(m, 'injury');
  }
  assert.ok(y / N >= 3.5 && y / N <= 6.5, `amarelos ${y / N}`);
  assert.ok(r / N >= 0.05 && r / N <= 0.5, `vermelhos ${r / N}`);
  assert.ok(inj / N >= 0.1 && inj / N <= 0.6, `lesões ${inj / N}`);
});

test('segundo amarelo vira vermelho; expulso sai e não aparece mais', () => {
  let checked = 0;
  for (let seed = 1; seed <= 400 && checked < 10; seed++) {
    const m = play(seed);
    for (const red of m.events.filter((e) => e.type === 'red')) {
      checked++;
      const yellows = m.events.filter((e) => e.type === 'yellow' && e.playerId === red.playerId);
      if (red.second) assert.equal(yellows.length, 2);
      const side = red.side;
      assert.ok(!m[side].lineup.some((p) => p.id === red.playerId), 'fora do time');
      const after = m.events.filter((e) => e.minute > red.minute && e.playerId === red.playerId);
      assert.deepEqual(after, []);
    }
  }
  assert.ok(checked > 0, 'nenhum vermelho nas partidas testadas');
});

test('time com um a menos perde força', () => {
  const m = createMatch({ home: makeTeam('A', 65), away: makeTeam('B', 65), seed: 1 });
  const before = matchStrength(m, 'home');
  bookPlayer(m, 'home', m.home.lineup.find((p) => p.pos === 'ZAG').id, 'red');
  const after = matchStrength(m, 'home');
  assert.equal(m.home.lineup.length, 10);
  assert.ok(after.attack < before.attack && after.defense < before.defense);
  assert.equal(count(m, 'red'), 1);
});

test('lesão: semanas de 1 a 8, jogador segue em campo com pouco gás', () => {
  let seen = 0;
  for (let seed = 1; seed <= 300 && seen < 5; seed++) {
    const m = play(seed);
    for (const e of m.events.filter((x) => x.type === 'injury')) {
      seen++;
      assert.ok(e.weeks >= 1 && e.weeks <= 8, `semanas ${e.weeks}`);
      assert.equal(m.injuries[e.playerId].weeks, e.weeks);
      assert.ok(m.energy[e.playerId] <= 30, `energia ${m.energy[e.playerId]}`);
    }
  }
  assert.ok(seen > 0);
});
