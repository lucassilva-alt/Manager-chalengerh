// B4: substituições — 5 trocas, 3 paradas (intervalo não conta), IA troca sozinha.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, advanceMinute, startSecondHalf, substitute, bookPlayer } from '../../src/engine/match-sim.js';
import { makeTeam } from './helpers.js';

const newMatch = (opts = {}) => createMatch({ home: makeTeam('A', 65, { bench: 7 }), away: makeTeam('B', 65, { bench: 7 }), seed: 3, userSide: 'home', ...opts });
const toMinute = (m, min) => { while (m.minute < min && m.phase !== 'ended') { if (m.phase === 'halftime') startSecondHalf(m); else advanceMinute(m); } };

test('troca: quem entra pega a vaga, com gás cheio e nota 6,5; quem sai não volta', () => {
  const m = newMatch();
  toMinute(m, 20);
  const out = m.home.lineup.find((p) => p.pos === 'MEI'), inc = m.home.bench.find((p) => p.pos === 'ATA');
  assert.equal(substitute(m, 'home', out.id, inc.id), true);
  const placed = m.home.lineup.find((p) => p.id === inc.id);
  assert.equal(placed.pos, 'MEI');
  assert.equal(placed.natural, 'ATA');
  assert.ok(placed.fit < 1);
  assert.equal(m.energy[inc.id], 100);
  assert.equal(m.ratings[inc.id], 6.5);
  assert.ok(!m.home.lineup.some((p) => p.id === out.id));
  assert.ok(!m.home.bench.some((p) => p.id === inc.id));
  assert.equal(m.events.at(-1).type, 'sub');
  assert.equal(substitute(m, 'home', inc.id, out.id), false, 'quem saiu não volta');
});

test('no máximo 5 trocas e 3 paradas; trocas no intervalo não gastam parada', () => {
  const m = newMatch();
  const swap = () => {
    const out = m.home.lineup.find((p) => p.pos !== 'GOL' && !m.subbedOn.includes(p.id));
    return substitute(m, 'home', out.id, m.home.bench.find((p) => p.pos !== 'GOL')?.id);
  };
  toMinute(m, 45);
  assert.equal(m.phase, 'halftime');
  assert.equal(swap(), true); // intervalo
  startSecondHalf(m);
  toMinute(m, 55); assert.equal(swap(), true); assert.equal(swap(), true); // parada 1
  toMinute(m, 60); assert.equal(swap(), true);                          // parada 2
  toMinute(m, 70); assert.equal(swap(), true);                          // parada 3 (5ª troca)
  toMinute(m, 75); assert.equal(swap(), false, '6ª troca');
  assert.equal(m.subs.home.count, 5);
  assert.equal(m.subs.home.stops.length, 3);
});

test('a 4ª parada é recusada mesmo com trocas sobrando', () => {
  const m = newMatch();
  const swap = () => substitute(m, 'home', m.home.lineup.find((p) => p.pos === 'ATA' || p.pos === 'MEI').id, m.home.bench.find((p) => p.pos !== 'GOL').id);
  for (const min of [10, 20, 30]) { toMinute(m, min); assert.equal(swap(), true); }
  toMinute(m, 40);
  assert.equal(swap(), false);
});

test('expulso não pode ser trocado; quem entra precisa estar no banco', () => {
  const m = newMatch();
  toMinute(m, 10);
  const zag = m.home.lineup.find((p) => p.pos === 'ZAG');
  bookPlayer(m, 'home', zag.id, 'red');
  assert.equal(substitute(m, 'home', zag.id, m.home.bench[1].id), false);
  assert.equal(substitute(m, 'home', m.home.lineup[1].id, 'ninguem'), false);
});

test('o time do jogo troca sozinho lesionados e cansados, até 5', () => {
  let subs = 0, matches = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const m = createMatch({ home: makeTeam('A', 65, { bench: 7 }), away: makeTeam('B', 65, { bench: 7 }), seed, userSide: 'home' });
    while (m.phase !== 'ended') { if (m.phase === 'halftime') startSecondHalf(m); else advanceMinute(m); }
    assert.ok(m.subs.away.count <= 5 && m.subs.away.stops.length <= 3);
    assert.equal(m.subs.home.count, 0, 'não mexe no time do jogador');
    for (const id of Object.keys(m.injuries)) {
      const wasAway = id.startsWith('B-');
      if (wasAway && m.subs.away.count < 5) assert.ok(!m.away.lineup.some((p) => p.id === id) || m.subs.away.stops.length >= 3, `lesionado ${id} seguiu`);
    }
    subs += m.subs.away.count; matches++;
  }
  assert.ok(subs / matches >= 2, `média de trocas ${subs / matches}`);
});
