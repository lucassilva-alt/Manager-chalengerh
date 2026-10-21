// L1: lance de defesa — o adversário ataca sozinho; você comanda os defensores.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, advanceMinute, startSecondHalf } from '../../src/engine/match-sim.js';
import { buildScenario } from '../../src/engine/highlight/scenario.js';
import { stepWorld } from '../../src/engine/highlight/highlight.js';
import { makeTeam } from './helpers.js';

function defensePending(seed, { defend = true } = {}) {
  const m = createMatch({ home: makeTeam('A', 65), away: makeTeam('B', 65), seed, userSide: 'home', interactive: true, defend });
  while (m.phase !== 'ended') {
    if (m.pending) {
      if (m.pending.side === 'away') return m;
      m.pending = null; // ignora as chances de ataque aqui
    }
    if (m.phase === 'halftime') startSecondHalf(m); else advanceMinute(m);
  }
  return null;
}

test('com defesa ligada, chance do adversário vira lance de defesa', () => {
  const m = defensePending(1);
  assert.ok(m, 'deveria haver um lance de defesa');
  assert.equal(m.pending.side, 'away');
  assert.equal(m.events.at(-1).type, 'highlight');
});

test('sem a opção, chance do adversário continua automática', () => {
  assert.equal(defensePending(1, { defend: false }), null);
});

test('cenário de defesa: adversário com a bola, jogador controla a defesa', () => {
  const m = defensePending(2);
  const w = buildScenario(m, { seed: 2 });
  assert.equal(w.mode, 'defense');
  assert.equal(w.attackingSide, 'away');
  assert.equal(w.userSide, 'home');
  assert.ok(m.away.lineup.some((p) => p.id === w.carrierId));
  assert.equal(w.awaitingInput, true, 'começa parado para planejar');
});

function play(seed, orders) {
  const m = defensePending(seed);
  if (!m) return null;
  const w = buildScenario(m, { seed });
  stepWorld(w, { type: 'go' });
  for (let i = 0; i < 60 * 20 && w.status === 'live'; i++) {
    stepWorld(w, orders?.(w, i) ?? null);
  }
  return w.status;
}

test('atacante do jogo termina o lance sozinho (gol, defesa, fora ou desarme)', () => {
  const out = {};
  for (let seed = 1; seed <= 120; seed++) {
    const s = play(seed);
    if (s) out[s] = (out[s] ?? 0) + 1;
  }
  assert.ok(!out.live && !out.timeout, JSON.stringify(out));
  assert.ok(out.goal > 0 && (out.saved ?? 0) + (out.wide ?? 0) + (out.lost ?? 0) > 0, JSON.stringify(out));
});

test('mandar o defensor mais perto dar o bote reduz os gols sofridos', () => {
  let passive = 0, active = 0;
  for (let seed = 1; seed <= 150; seed++) {
    if (play(seed) === 'goal') passive++;
    const s = play(seed, (w, i) => {
      if (i % 30 !== 0 || !w.carrierId) return null;
      const c = w.agents.find((a) => a.id === w.carrierId);
      const def = w.agents.filter((a) => a.side === w.userSide && a.role !== 'GK')
        .sort((a, b) => Math.hypot(a.pos.x - c.pos.x, a.pos.y - c.pos.y) - Math.hypot(b.pos.x - c.pos.x, b.pos.y - c.pos.y))[0];
      return { type: 'press', by: def.id };
    });
    if (s === 'goal') active++;
  }
  assert.ok(active < passive, `com bote ${active}, sem ${passive}`);
});

test('comando de posicionar move o defensor para o ponto', () => {
  const m = defensePending(3);
  const w = buildScenario(m, { seed: 3 });
  const d = w.agents.find((a) => a.side === 'home' && a.role !== 'GK');
  stepWorld(w, { type: 'move', by: d.id, to: { x: 40, y: 5 } });
  for (let i = 0; i < 60 * 3; i++) stepWorld(w);
  assert.ok(Math.hypot(d.pos.x - 40, d.pos.y - 5) < 3 || w.status !== 'live');
});
