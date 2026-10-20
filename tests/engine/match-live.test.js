import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, advanceMinute, startSecondHalf, setTactics } from '../../src/engine/match-sim.js';
import { makeTeam } from './helpers.js';

function play(m) {
  while (m.phase !== 'ended') {
    if (m.phase === 'halftime') startSecondHalf(m);
    else advanceMinute(m);
  }
  return m;
}
const newMatch = (seed, hl = 65, al = 65) => createMatch({ home: makeTeam('A', hl), away: makeTeam('B', al), seed });
const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

// A6 — nota ao vivo e energia
test('todos começam com nota 6.5 e energia 100', () => {
  const m = newMatch(1);
  const ids = [...m.home.lineup, ...m.away.lineup].map((p) => p.id);
  for (const id of ids) {
    assert.equal(m.ratings[id], 6.5);
    assert.equal(m.energy[id], 100);
  }
});

test('energia cai ao longo do jogo e cai mais com ritmo de trabalho alto', () => {
  const m = newMatch(2);
  setTactics(m, 'home', { workRate: 9 });
  setTactics(m, 'away', { workRate: 2 });
  play(m);
  const home = avg(m.home.lineup.map((p) => m.energy[p.id]));
  const away = avg(m.away.lineup.map((p) => m.energy[p.id]));
  assert.ok(home < 100 && away < 100);
  assert.ok(home < away, `casa ${home} visitante ${away}`);
});

test('no minuto do gol: autor sobe a nota e goleiro que sofre cai', () => {
  let checked = 0;
  for (let seed = 1; seed <= 200 && checked < 20; seed++) {
    const m = newMatch(seed);
    while (m.phase !== 'ended') {
      if (m.phase === 'halftime') { startSecondHalf(m); continue; }
      const before = { ...m.ratings };
      const from = m.events.length;
      advanceMinute(m);
      const minuteEvents = m.events.slice(from).filter((e) => e.type === 'chance');
      // Só minutos com um único lance, para isolar o efeito do gol.
      if (minuteEvents.length !== 1 || minuteEvents[0].outcome !== 'goal') continue;
      const goal = minuteEvents[0];
      const gk = m[goal.side === 'home' ? 'away' : 'home'].lineup.find((p) => p.pos === 'GOL');
      assert.ok(m.ratings[goal.playerId] > before[goal.playerId]);
      assert.ok(m.ratings[gk.id] < before[gk.id]);
      checked++;
      break;
    }
  }
  assert.ok(checked >= 10, `verificados ${checked}`);
});

test('notas ficam entre 3 e 10', () => {
  const m = play(newMatch(9, 85, 40));
  for (const r of Object.values(m.ratings)) assert.ok(r >= 3 && r <= 10);
});

// A7 — ritmo e foco
function goalsOver(seeds, setup) {
  let scored = 0, conceded = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const m = newMatch(seed);
    setup(m);
    play(m);
    scored += m.score.home;
    conceded += m.score.away;
  }
  return { scored, conceded };
}

test('ritmo alto gera mais gols do que ritmo baixo', () => {
  const high = goalsOver(500, (m) => setTactics(m, 'home', { workRate: 9 }));
  const low = goalsOver(500, (m) => setTactics(m, 'home', { workRate: 2 }));
  assert.ok(high.scored > low.scored, `alto ${high.scored} baixo ${low.scored}`);
});

test('foco no ataque marca mais e sofre mais que o equilibrado', () => {
  const attack = goalsOver(500, (m) => setTactics(m, 'home', { focus: 'attack' }));
  const balanced = goalsOver(500, () => {});
  assert.ok(attack.scored > balanced.scored);
  assert.ok(attack.conceded > balanced.conceded);
});

test('setTactics limita o ritmo a 1–10 e ignora foco inválido', () => {
  const m = newMatch(1);
  setTactics(m, 'home', { workRate: 99, focus: 'xyz' });
  assert.deepEqual(m.tactics.home, { workRate: 10, focus: 'balanced' });
  setTactics(m, 'home', { workRate: -3 });
  assert.equal(m.tactics.home.workRate, 1);
});
