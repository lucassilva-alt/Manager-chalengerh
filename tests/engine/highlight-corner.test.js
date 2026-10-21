// L4: escanteio — escolher o alvo do cruzamento e cabecear no tempo certo;
// contra: afastar no tempo certo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch } from '../../src/engine/match-sim.js';
import { buildScenario } from '../../src/engine/highlight/scenario.js';
import { stepWorld } from '../../src/engine/highlight/highlight.js';
import { FIELD } from '../../src/engine/highlight/field.js';
import { makeTeam } from './helpers.js';

function cornerMatch(side, seed = 1) {
  const m = createMatch({ home: makeTeam('A', 65), away: makeTeam('B', 65), seed, userSide: 'home', interactive: true, defend: true });
  const finisher = m[side].lineup.find((p) => p.pos === 'ATA');
  m.pending = { side, kind: 'corner', playerId: finisher.id, conversion: 0.1 };
  return m;
}
const inBox = (p) => FIELD.halfLength - p.x < 16.5 && Math.abs(p.y) < 20.16;

// Cruza para `to` e aperta o cabeceio `early` segundos antes da chegada (null = não aperta).
function playCorner(w, { to = { x: 47, y: 0 }, early = 0, aim = 0.6, first = { type: 'cross', to } } = {}) {
  stepWorld(w, first);
  let pressed = early === null;
  for (let i = 0; i < 60 * 8 && w.status === 'live'; i++) {
    const c = w.corner;
    if (!pressed && c?.arrive != null && w.t >= c.arrive - early - 1e-9) {
      pressed = true;
      stepWorld(w, { type: 'header', aim });
    } else stepWorld(w);
  }
  return w.status;
}

test('escanteio a favor: bola no canto, atacantes na área marcados, esperando o cruzamento', () => {
  for (let seed = 1; seed <= 10; seed++) {
    const w = buildScenario(cornerMatch('home', seed), { seed });
    assert.equal(w.mode, 'corner');
    assert.equal(w.awaitingInput, true);
    const b = w.ball.pos;
    assert.ok(FIELD.halfLength - b.x < 1 && FIELD.halfWidth - Math.abs(b.y) < 1, `bola em ${b.x},${b.y}`);
    const attackers = w.agents.filter((a) => a.side === 'home' && inBox(a.pos));
    assert.ok(attackers.length >= 4, `atacantes na área ${attackers.length}`);
    for (const a of attackers) {
      const marker = w.agents.some((d) => d.side === 'away' && d.role !== 'GK' && Math.hypot(d.pos.x - a.pos.x, d.pos.y - a.pos.y) < 1.5);
      assert.ok(marker, `${a.id} sem marcação`);
    }
  }
});

test('escanteio a favor: antes do cruzamento só aceita o alvo', () => {
  const w = buildScenario(cornerMatch('home'), { seed: 1 });
  stepWorld(w, { type: 'shoot', dir: { x: 1, y: 0 }, power: 1 });
  stepWorld(w, { type: 'header', aim: 0 });
  assert.equal(w.awaitingInput, true);
  assert.equal(w.lastKick, null);
});

test('escanteio a favor: o cruzamento chega perto do alvo na altura da cabeça', () => {
  for (const to of [{ x: 47, y: 0 }, { x: 45, y: -5 }, { x: 49, y: 4 }]) {
    const w = buildScenario(cornerMatch('home', 3), { seed: 3 });
    playCorner(w, { to, early: null });
    const at = w.corner.landing;
    assert.ok(Math.hypot(at.x - to.x, at.y - to.y) < 2, `chegou a ${at.x.toFixed(1)},${at.y.toFixed(1)} (alvo ${to.x},${to.y})`);
    assert.ok(at.z > 1 && at.z < 3, `altura ${at.z}`);
  }
});

test('escanteio a favor: cabecear no tempo certo vira gol bem mais que fora do tempo', () => {
  let onTime = 0, early = 0, none = 0;
  for (let seed = 1; seed <= 150; seed++) {
    if (playCorner(buildScenario(cornerMatch('home', seed), { seed }), { early: 0 }) === 'goal') onTime++;
    if (playCorner(buildScenario(cornerMatch('home', seed), { seed }), { early: 0.7 }) === 'goal') early++;
    if (playCorner(buildScenario(cornerMatch('home', seed), { seed }), { early: null }) === 'goal') none++;
  }
  assert.ok(onTime / 150 >= 0.12 && onTime / 150 <= 0.45, `no tempo ${onTime}/150`);
  assert.ok(onTime > early + 12, `no tempo ${onTime}, cedo ${early}`);
  assert.ok(none <= 3, `sem cabecear ${none}`);
});

test('escanteio contra: afastar no tempo certo sofre menos gol que não afastar', () => {
  const w0 = buildScenario(cornerMatch('away'), { seed: 1 });
  assert.equal(w0.mode, 'cornerDefense');
  let good = 0, none = 0;
  for (let seed = 1; seed <= 150; seed++) {
    if (playCorner(buildScenario(cornerMatch('away', seed), { seed }), { first: { type: 'go' }, early: 0 }) === 'goal') good++;
    if (playCorner(buildScenario(cornerMatch('away', seed), { seed }), { first: { type: 'go' }, early: null }) === 'goal') none++;
  }
  assert.ok(good < none - 10, `afastando ${good}, sem afastar ${none}`);
});

test('voltar o lance no escanteio sorteia de novo o alvo e o tempo do jogo', async () => {
  const { startHighlight, rewindHighlight } = await import('../../src/engine/highlight/scenario.js');
  let changed = 0;
  for (let seed = 1; seed <= 60; seed++) {
    const m = cornerMatch('away', seed);
    const w = startHighlight(m, { seed });
    const again = rewindHighlight(m);
    if (again.corner.aiTiming !== w.corner.aiTiming || again.corner.aiAim !== w.corner.aiAim) changed++;
  }
  assert.ok(changed > 50, `mudou em ${changed}/60`);
});
