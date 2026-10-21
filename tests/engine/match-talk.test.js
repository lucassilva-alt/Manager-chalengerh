// B5: conversa no intervalo — efeito na moral pelo placar e pela personalidade;
// moral pesa no rendimento.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, advanceMinute, halftimeTalk, matchStrength } from '../../src/engine/match-sim.js';
import { makeTeam } from './helpers.js';

function atHalftime(seed, { homeGoals = 0, awayGoals = 0, traits = [] } = {}) {
  const home = makeTeam('A', 65), away = makeTeam('B', 65);
  home.lineup.forEach((p) => { p.traits = traits; });
  const m = createMatch({ home, away, seed, userSide: 'home' });
  while (m.phase === 'first') advanceMinute(m);
  m.score = { home: homeGoals, away: awayGoals };
  return m;
}
const avgMorale = (m) => m.home.lineup.reduce((s, p) => s + m.morale[p.id], 0) / m.home.lineup.length;

test('só no intervalo e uma vez por jogo', () => {
  const m = createMatch({ home: makeTeam('A', 65), away: makeTeam('B', 65), seed: 1, userSide: 'home' });
  assert.equal(halftimeTalk(m, 'home', 'praise'), false, 'no 1º tempo não');
  const h = atHalftime(1);
  assert.equal(halftimeTalk(h, 'home', 'praise'), true);
  assert.equal(halftimeTalk(h, 'home', 'demand'), false, 'segunda conversa não');
  assert.equal(h.events.at(-1).type, 'talk');
});

test('perdendo, cobrar motiva mais que elogiar; ganhando, elogiar motiva mais que cobrar', () => {
  const lose = (tone) => { const m = atHalftime(2, { awayGoals: 1 }); const b = avgMorale(m); halftimeTalk(m, 'home', tone); return avgMorale(m) - b; };
  const win = (tone) => { const m = atHalftime(2, { homeGoals: 1 }); const b = avgMorale(m); halftimeTalk(m, 'home', tone); return avgMorale(m) - b; };
  assert.ok(lose('demand') > lose('praise'));
  assert.ok(win('praise') > win('demand'));
  assert.ok(lose('demand') > 0 && win('praise') > 0);
});

test('cobrar temperamentais é arriscado: alguns sentem e caem', () => {
  let dropped = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const m = atHalftime(seed, { awayGoals: 1, traits: ['Temperamental'] });
    const before = Object.fromEntries(m.home.lineup.map((p) => [p.id, m.morale[p.id]]));
    halftimeTalk(m, 'home', 'demand');
    dropped += m.home.lineup.filter((p) => m.morale[p.id] < before[p.id]).length;
  }
  assert.ok(dropped > 20, `caíram ${dropped}`);
});

test('acalmar sempre ajuda um pouco, mais ainda os temperamentais', () => {
  const calm = (traits) => { const m = atHalftime(3, { traits }); const b = avgMorale(m); halftimeTalk(m, 'home', 'calm'); return avgMorale(m) - b; };
  assert.ok(calm([]) > 0);
  assert.ok(calm(['Temperamental']) > calm([]));
});

test('moral alta rende mais que moral baixa', () => {
  const m = atHalftime(4);
  for (const p of m.home.lineup) m.morale[p.id] = 95;
  const high = matchStrength(m, 'home');
  for (const p of m.home.lineup) m.morale[p.id] = 20;
  const low = matchStrength(m, 'home');
  assert.ok(high.attack > low.attack && high.defense > low.defense);
});
