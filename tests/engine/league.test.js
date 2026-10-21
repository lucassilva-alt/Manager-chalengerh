// Liga de pontos corridos: tabela de jogos, classificação, rodada simulada,
// acesso e rebaixamento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSchedule, createTable, recordResult, standings, playRound, promoteRelegate } from '../../src/engine/league.js';
import { makeTeam } from './helpers.js';

const ids = Array.from({ length: 20 }, (_, i) => `t${i + 1}`);

test('ida e volta: 38 rodadas, 10 jogos, cada time uma vez por rodada, cada par 2x com mando trocado', () => {
  const s = createSchedule(ids, 7);
  assert.equal(s.length, 38);
  const pairs = new Map();
  for (const round of s) {
    assert.equal(round.length, 10);
    const seen = round.flatMap((g) => [g.home, g.away]);
    assert.equal(new Set(seen).size, 20);
    for (const g of round) {
      const key = [g.home, g.away].sort().join('|');
      pairs.set(key, [...(pairs.get(key) ?? []), g.home]);
    }
  }
  assert.equal(pairs.size, 190);
  for (const homes of pairs.values()) assert.equal(new Set(homes).size, 2);
  assert.deepEqual(createSchedule(ids, 7), s, 'mesma semente, mesma tabela');
});

test('mando alternado: ninguém fica mais de 3 rodadas seguidas no mesmo mando', () => {
  const s = createSchedule(ids, 3);
  for (const id of ids) {
    let run = 0, worst = 0, last = null;
    for (const round of s) {
      const home = round.find((g) => g.home === id || g.away === id).home === id;
      run = home === last ? run + 1 : 1; last = home; worst = Math.max(worst, run);
    }
    assert.ok(worst <= 3, `${id}: ${worst} seguidas`);
  }
});

test('classificação: pontos, vitórias, saldo, gols pró', () => {
  const t = createTable(['a', 'b', 'c', 'd']);
  recordResult(t, 'a', 'b', 2, 0); // a 3
  recordResult(t, 'c', 'd', 1, 1); // c 1, d 1
  recordResult(t, 'b', 'c', 3, 0); // b 3
  recordResult(t, 'd', 'a', 1, 1); // d 2, a 4
  const order = standings(t).map((r) => r.id);
  assert.deepEqual(order, ['a', 'b', 'd', 'c']);
  const a = t.a;
  assert.deepEqual([a.played, a.won, a.drawn, a.lost, a.gf, a.ga, a.points], [2, 1, 1, 0, 3, 1, 4]);
});

test('rodada: joga as outras partidas e devolve a do jogador sem jogar', () => {
  const teams = Object.fromEntries(ids.slice(0, 4).map((id, i) => [id, { ...makeTeam(id, 60 + i * 3), id }]));
  const sched = createSchedule(Object.keys(teams), 1);
  const table = createTable(Object.keys(teams));
  const { results, userGame } = playRound({ round: sched[0], teams, table, seed: 5, userTeam: 't1' });
  assert.equal(results.length, 1);
  assert.ok(userGame.home === 't1' || userGame.away === 't1');
  assert.equal(standings(table).reduce((s, r) => s + r.played, 0), 2);
});

test('acesso e rebaixamento: 4 últimos da A trocam com 4 primeiros da B', () => {
  const a = ids.slice(0, 20), b = ids.map((x) => `b${x}`);
  const ta = createTable(a), tb = createTable(b);
  a.forEach((id, i) => { ta[id].points = 60 - i; });
  b.forEach((id, i) => { tb[id].points = 70 - i; });
  const { serieA, serieB } = promoteRelegate(ta, tb, 4);
  assert.equal(serieA.length, 20); assert.equal(serieB.length, 20);
  assert.ok(['bt1', 'bt2', 'bt3', 'bt4'].every((id) => serieA.includes(id)));
  assert.ok(['t17', 't18', 't19', 't20'].every((id) => serieB.includes(id)));
});
