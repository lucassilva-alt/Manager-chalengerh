// Carreira: escolher clube, rodadas com o jogo do usuário, temporada completa,
// acesso/rebaixamento e salvar (JSON puro).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCareer, nextFixture, completeRound, seasonOver, endSeason, userDivision } from '../../src/engine/career.js';

// Clubes e elencos sintéticos de teste (não são dados reais).
const POS = ['GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', 'FW'];
const clubs = Array.from({ length: 40 }, (_, i) => ({
  id: `c${i}`, name: `Clube ${i}`, short: `C${String(i).padStart(2, '0')}`.slice(0, 3), colors: { shirt: '#123456', shorts: '#ffffff' },
  crest: 'x', stadium: 'E', capacity: 10000, city: 'X', division: i < 20 ? 'A' : 'B',
}));
const squads = Object.fromEntries(clubs.map((c) => [c.id, { club: c.id, source: 'https://teste', players: POS.map((pos, j) => ({ name: `${c.id}-${j}`, pos, number: j + 1, birthDate: null })) }]));
const setup = (clubId = 'c3') => newCareer({ clubs, squads, clubId, seed: 9, asOf: '2026-10-21', season: 2026 });

test('nova carreira: 40 times montados, clube do usuário na sua divisão, rodada 1', () => {
  const c = setup();
  assert.equal(Object.keys(c.teams).length, 40);
  assert.equal(userDivision(c), 'A');
  assert.equal(c.round, 0);
  assert.equal(c.teams.c3.lineup.length, 11);
  const f = nextFixture(c);
  assert.ok(f.home === 'c3' || f.away === 'c3');
  assert.equal(f.round, 1);
});

test('completar a rodada registra o jogo do usuário e simula todos os outros', () => {
  const c = setup();
  const f = nextFixture(c);
  completeRound(c, { home: 2, away: 1 });
  assert.equal(c.round, 1);
  const all = [...Object.values(c.tables.A), ...Object.values(c.tables.B)];
  assert.ok(all.every((r) => r.played === 1));
  const home = c.tables.A[f.home];
  assert.deepEqual([home.gf, home.ga, home.points], [2, 1, 3]);
  assert.equal(c.results.at(-1).score.home, 2);
});

test('temporada inteira, acesso e rebaixamento, e a carreira cabe em JSON', () => {
  let c = setup('c25');
  assert.equal(userDivision(c), 'B');
  while (!seasonOver(c)) completeRound(c, { home: 1, away: 0 });
  assert.equal(c.round, 38);
  c = JSON.parse(JSON.stringify(c));
  const before = c.divisions;
  endSeason(c);
  assert.equal(c.season, 2027);
  assert.equal(c.round, 0);
  assert.equal(c.divisions.A.length, 20);
  assert.equal(c.divisions.B.length, 20);
  const moved = c.divisions.A.filter((id) => before.B.includes(id));
  assert.equal(moved.length, 4);
  assert.ok(Object.values(c.tables.A).every((r) => r.played === 0));
  assert.ok(nextFixture(c));
});
