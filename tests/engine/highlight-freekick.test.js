// L3: falta — barreira, chute por cima com efeito; contra: tamanho da barreira.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from '../../src/engine/match-sim.js';
import { buildScenario } from '../../src/engine/highlight/scenario.js';
import { stepWorld } from '../../src/engine/highlight/highlight.js';
import { FIELD } from '../../src/engine/highlight/field.js';
import { makeTeam } from './helpers.js';

function fkMatch(side, seed = 1) {
  const m = createMatch({ home: makeTeam('A', 70), away: makeTeam('B', 65), seed, userSide: 'home', interactive: true, defend: true });
  const shooter = m[side].lineup.find((p) => p.pos === 'MEI');
  m.pending = { side, kind: 'freekick', playerId: shooter.id, conversion: 0.09 };
  return m;
}
function run(w, first, max = 60 * 6) {
  stepWorld(w, first);
  for (let i = 0; i < max && w.status === 'live'; i++) stepWorld(w);
  return w.status;
}
const goal = FIELD.halfLength;

test('falta: bola entre 18 e 32 m do gol, barreira a 9,15 m entre a bola e o gol', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const w = buildScenario(fkMatch('home', seed), { seed });
    assert.equal(w.mode, 'freekick');
    const b = w.ball.pos;
    const d = Math.hypot(goal - b.x, b.y);
    assert.ok(d >= 18 && d <= 32, `distância ${d}`);
    assert.ok(w.wall.size >= 3 && w.wall.size <= 5);
    const wallDist = Math.hypot(w.wall.center.x - b.x, w.wall.center.y - b.y);
    assert.ok(Math.abs(wallDist - 9.15) < 0.2, `barreira a ${wallDist}`);
    const inWall = w.agents.filter((a) => a.inWall);
    assert.equal(inWall.length, w.wall.size);
  }
});

test('falta a favor: chute rasteiro e forte na barreira é bloqueado quase sempre', () => {
  let blocked = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const w = buildScenario(fkMatch('home', seed), { seed });
    const t = w.wall.center;
    const s = run(w, { type: 'shoot', dir: { x: t.x - w.ball.pos.x, y: t.y - w.ball.pos.y }, power: 0.9, lift: 0.05 });
    if (w.events.some((e) => e.type === 'wallBlock')) blocked++;
  }
  assert.ok(blocked > 50, `bloqueados ${blocked}/60`);
});

// Falta direta no futebol real vira gol ~7–10% das vezes.
test('falta a favor: chute por cima da barreira com efeito para o canto às vezes entra', () => {
  let goals = 0, blocked = 0;
  for (let seed = 1; seed <= 150; seed++) {
    const w = buildScenario(fkMatch('home', seed), { seed });
    const far = w.wall.center.y > w.ball.pos.y ? -1 : 1;  // canto oposto ao lado da barreira
    const aim = { x: goal, y: far * 2.4 };
    const s = run(w, { type: 'shoot', dir: { x: aim.x - w.ball.pos.x, y: aim.y - w.ball.pos.y }, power: 0.55, lift: 0.7, curl: -far * 0.6 });
    if (s === 'goal') goals++;
    if (w.events.some((e) => e.type === 'wallBlock')) blocked++;
  }
  assert.ok(goals >= 9, `gols ${goals}/150`);
  assert.ok(blocked < 40, `bloqueados ${blocked}/150`);
});

test('falta contra: barreira maior bloqueia mais chutes', () => {
  const blocks = (size) => {
    let n = 0;
    for (let seed = 1; seed <= 150; seed++) {
      const w = buildScenario(fkMatch('away', seed), { seed });
      assert.equal(w.mode, 'freekickDefense');
      run(w, { type: 'go', wall: size });
      if (w.events.some((e) => e.type === 'wallBlock')) n++;
    }
    return n;
  };
  assert.ok(blocks(5) > blocks(3), 'barreira de 5 bloqueia mais que a de 3');
});
