import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, advanceMinute, startSecondHalf } from '../../src/engine/match-sim.js';
import { startHighlight, rewindHighlight, finishHighlight } from '../../src/engine/highlight/scenario.js';
import { stepWorld } from '../../src/engine/highlight/highlight.js';
import { createRecorder } from '../../src/engine/highlight/replay.js';
import { FIELD } from '../../src/engine/highlight/field.js';
import { makeTeam } from './helpers.js';

function pendingMatch(seed = 1) {
  const m = createMatch({ home: makeTeam('A', 65), away: makeTeam('B', 65), seed, userSide: 'home', interactive: true });
  while (!m.pending && m.phase !== 'ended') { if (m.phase === 'halftime') startSecondHalf(m); else advanceMinute(m); }
  return m;
}

// A16 — voltar o lance
test('partida começa com 1 "voltar o lance"', () => {
  assert.equal(pendingMatch().rewindsLeft, 1);
});

test('voltar o lance restaura o estado idêntico ao início do lance', () => {
  const m = pendingMatch(2);
  const w = startHighlight(m, { seed: 7 });
  const initial = structuredClone(w);
  stepWorld(w, { type: 'dribble', dir: { x: 1, y: 0 } });
  for (let i = 0; i < 90; i++) stepWorld(w);
  const restored = rewindHighlight(m);
  assert.deepEqual(restored, initial);
  assert.equal(m.rewindsLeft, 0);
});

test('só dá para voltar uma vez por partida', () => {
  const m = pendingMatch(3);
  startHighlight(m, { seed: 1 });
  assert.ok(rewindHighlight(m));
  assert.equal(rewindHighlight(m), null);
});

test('mexer no lance restaurado não altera a cópia guardada', () => {
  const m = pendingMatch(4);
  startHighlight(m, { seed: 1 });
  const saved = structuredClone(m.highlightStart);
  const w = rewindHighlight(m);
  w.agents[0].pos.x = 999;
  assert.deepEqual(m.highlightStart, saved);
});

test('encerrar o lance limpa a cópia guardada', () => {
  const m = pendingMatch(5);
  const w = startHighlight(m, { seed: 1 });
  w.status = 'saved';
  finishHighlight(m, w);
  assert.equal(m.highlightStart, null);
});

// A17 — replay
test('gravar o mesmo instante duas vezes não duplica quadro', () => {
  const m = pendingMatch(6);
  const w = startHighlight(m, { seed: 1 });
  const rec = createRecorder({ seconds: 2 });
  stepWorld(w);
  rec.record(w);
  rec.record(w);
  assert.equal(rec.frames().length, 1);
});

test('gravador guarda só os últimos segundos, em ordem', () => {
  const m = pendingMatch(6);
  const w = startHighlight(m, { seed: 1, defendersIdle: true });
  const rec = createRecorder({ seconds: 2 });
  for (let i = 0; i < 60 * 5; i++) { stepWorld(w); rec.record(w); }
  const frames = rec.frames();
  assert.equal(frames.length, 120);
  for (let i = 1; i < frames.length; i++) assert.ok(frames[i].t > frames[i - 1].t);
  const last = frames.at(-1);
  assert.deepEqual(last.ball, { x: w.ball.pos.x, y: w.ball.pos.y, z: w.ball.pos.z });
  assert.equal(last.agents.length, 22);
});

test('replay do gol informa autor e distância do chute', () => {
  const m = pendingMatch(7);
  const w = startHighlight(m, { seed: 1, defendersIdle: true });
  w.agents = w.agents.filter((a) => a.side === 'home');   // sem defesa nem goleiro
  const rec = createRecorder({ seconds: 3 });
  const c = w.agents.find((a) => a.id === w.carrierId);
  stepWorld(w, { type: 'shoot', dir: { x: FIELD.halfLength - c.pos.x, y: -c.pos.y }, power: 0.8, lift: 0.1 });
  for (let i = 0; i < 240 && w.status === 'live'; i++) { stepWorld(w); rec.record(w); }
  assert.equal(w.status, 'goal');
  const info = rec.summary(w);
  assert.equal(info.scorerId, c.id);
  assert.equal(info.distance, Number(Math.hypot(FIELD.halfLength - c.pos.x, c.pos.y).toFixed(1)));
});
