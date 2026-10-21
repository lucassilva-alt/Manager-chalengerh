// L2: pênalti — a favor (você bate) e contra (você escolhe o canto do goleiro).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from '../../src/engine/match-sim.js';
import { buildScenario } from '../../src/engine/highlight/scenario.js';
import { stepWorld } from '../../src/engine/highlight/highlight.js';
import { FIELD } from '../../src/engine/highlight/field.js';
import { makeTeam } from './helpers.js';

const SPOT_X = FIELD.halfLength - 11;

function penaltyMatch(side, seed = 1, { keeper = 65 } = {}) {
  const home = makeTeam('A', 65), away = makeTeam('B', 65, { gk: keeper });
  if (side === 'away') home.lineup[0].attrs.goalkeeping = keeper;
  const m = createMatch({ home, away, seed, userSide: 'home', interactive: true, defend: true });
  const shooter = m[side].lineup.find((p) => p.pos === 'ATA');
  m.pending = { side, kind: 'penalty', playerId: shooter.id, conversion: 0.76 };
  return m;
}
function run(w, first, max = 60 * 6) {
  stepWorld(w, first);
  for (let i = 0; i < max && w.status === 'live'; i++) stepWorld(w);
  return w.status;
}
const shotAt = (w, y, power = 0.8) => {
  const s = w.agents.find((a) => a.id === w.carrierId);
  return { type: 'shoot', dir: { x: FIELD.halfLength - s.pos.x, y: y - s.pos.y }, power, lift: 0.1 };
};

test('pênalti a favor: batedor na marca, só o goleiro na área, esperando o chute', () => {
  const w = buildScenario(penaltyMatch('home'), { seed: 1 });
  assert.equal(w.mode, 'penalty');
  const s = w.agents.find((a) => a.id === w.carrierId);
  assert.ok(Math.abs(s.pos.x - SPOT_X) < 0.5 && Math.abs(s.pos.y) < 0.1, 'na marca');
  const inBox = w.agents.filter((a) => a.id !== s.id && FIELD.halfLength - a.pos.x < 16.5 && Math.abs(a.pos.y) < 20.16);
  assert.deepEqual(inBox.map((a) => a.role), ['GK']);
  assert.equal(w.awaitingInput, true);
});

test('pênalti a favor: só aceita chute (sem conduzir ou passar)', () => {
  const w = buildScenario(penaltyMatch('home'), { seed: 1 });
  stepWorld(w, { type: 'dribble', dir: { x: 1, y: 0 } });
  assert.equal(w.awaitingInput, true);
});

test('pênalti a favor: bater no canto contrário ao pulo do goleiro converte bem mais', () => {
  let away = 0, into = 0, total = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const probe = buildScenario(penaltyMatch('home', seed), { seed });
    const dive = probe.penalty.keeperDive; // canto que o goleiro do jogo vai escolher
    if (dive === 0) continue;
    total++;
    const a = buildScenario(penaltyMatch('home', seed), { seed });
    if (run(a, shotAt(a, -dive * 3.0)) === 'goal') away++;
    const b = buildScenario(penaltyMatch('home', seed), { seed });
    if (run(b, shotAt(b, dive * 3.0)) === 'goal') into++;
  }
  assert.ok(away / total > 0.7, `contrário ${away}/${total}`);
  assert.ok(into < away - total * 0.3, `no pulo ${into}, contrário ${away}`);
});

test('pênalti a favor: aproveitamento geral fica entre 60% e 90%', () => {
  let goals = 0;
  for (let seed = 1; seed <= 300; seed++) {
    const w = buildScenario(penaltyMatch('home', seed), { seed });
    const side = seed % 2 ? 1 : -1; // batedor alterna os cantos
    if (run(w, shotAt(w, side * 3.0)) === 'goal') goals++;
  }
  assert.ok(goals / 300 > 0.6 && goals / 300 < 0.9, `aproveitamento ${goals / 300}`);
});

test('pênalti contra: modo do goleiro, escolher o canto certo defende mais', () => {
  const w = buildScenario(penaltyMatch('away'), { seed: 1 });
  assert.equal(w.mode, 'penaltyDefense');
  let right = 0, wrong = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const probe = buildScenario(penaltyMatch('away', seed), { seed });
    const side = probe.penalty.shotSide; // lado que o batedor do jogo vai escolher
    const a = buildScenario(penaltyMatch('away', seed), { seed });
    stepWorld(a, { type: 'dive', dir: side });
    if (run(a, { type: 'go' }) !== 'goal') right++;
    const b = buildScenario(penaltyMatch('away', seed), { seed });
    stepWorld(b, { type: 'dive', dir: side === 0 ? 1 : -side });
    if (run(b, { type: 'go' }) !== 'goal') wrong++;
  }
  assert.ok(right > wrong + 40, `certo ${right} errado ${wrong}`);
});

test('voltar o lance no pênalti sorteia de novo o canto do goleiro (não dá para "colar")', async () => {
  const { startHighlight, rewindHighlight } = await import('../../src/engine/highlight/scenario.js');
  let changed = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const m = penaltyMatch('home', seed);
    const w = startHighlight(m, { seed });
    const again = rewindHighlight(m);
    if (again.penalty.keeperDive !== w.penalty.keeperDive || again.penalty.shotSide !== w.penalty.shotSide) changed++;
  }
  assert.ok(changed > 25, `mudou em ${changed}/60`);
});
