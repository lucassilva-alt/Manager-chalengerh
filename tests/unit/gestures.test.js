import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyGesture, swipeToShot } from '../../src/input/gestures.js';

const base = { carrierId: 'c', carrierPos: { x: 0, y: 0 }, teammates: ['t1', 't2'] };

// A20 — conduzir, passar e abrir o chute
test('arrastar a partir do jogador com a bola = conduzir na direção do arrasto', () => {
  const cmd = classifyGesture({ ...base, start: { x: 0.3, y: 0 }, end: { x: 4, y: 3 }, duration: 400, startHit: 'c' });
  assert.equal(cmd.type, 'dribble');
  assert.ok(Math.abs(Math.atan2(cmd.dir.y, cmd.dir.x) - Math.atan2(3, 3.7)) < 1e-9);
  assert.ok(Math.abs(cmd.length - Math.hypot(3.7, 3)) < 1e-9);
});

test('tocar num companheiro = passe para ele', () => {
  const cmd = classifyGesture({ ...base, start: { x: 9, y: 2 }, end: { x: 9.1, y: 2 }, duration: 120, startHit: 't1', endHit: 't1' });
  assert.deepEqual(cmd, { type: 'pass', to: 't1' });
});

test('arrastar do jogador até um companheiro = passe', () => {
  const cmd = classifyGesture({ ...base, start: { x: 0, y: 0 }, end: { x: 9, y: 2 }, duration: 500, startHit: 'c', endHit: 't2' });
  assert.deepEqual(cmd, { type: 'pass', to: 't2' });
});

test('tocar no gol = abrir a mira do chute', () => {
  const cmd = classifyGesture({ ...base, start: { x: 51, y: 1 }, end: { x: 51, y: 1 }, duration: 100, goalHit: true });
  assert.deepEqual(cmd, { type: 'aimShot' });
});

test('toque no vazio ou arrasto longe do jogador não faz nada', () => {
  assert.equal(classifyGesture({ ...base, start: { x: 20, y: 20 }, end: { x: 20, y: 20 }, duration: 100 }), null);
  assert.equal(classifyGesture({ ...base, start: { x: 20, y: 20 }, end: { x: 25, y: 20 }, duration: 300 }), null);
});

test('tocar no adversário não faz nada no ataque', () => {
  assert.equal(classifyGesture({ ...base, start: { x: 5, y: 0 }, end: { x: 5, y: 0 }, duration: 100, startHit: 'opp' }), null);
});

// A21 — deslizar no close da bola
const screen = { width: 800, height: 400 };
const swipe = (pts) => pts.map(([x, y], i) => ({ x, y, t: i * 30 }));

test('deslize para cima, reto, no meio = chute no meio sem efeito', () => {
  const s = swipeToShot(swipe([[400, 380], [400, 300], [400, 220]]), screen);
  assert.ok(s.power > 0.3);
  assert.equal(s.aim, 0);
  assert.equal(s.curl, 0);
});

test('deslize mais longo = mais força', () => {
  const short = swipeToShot(swipe([[400, 380], [400, 320]]), screen);
  const long = swipeToShot(swipe([[400, 380], [400, 140]]), screen);
  assert.ok(long.power > short.power);
});

test('deslize para a direita mira o lado direito', () => {
  const s = swipeToShot(swipe([[400, 380], [460, 300], [520, 220]]), screen);
  assert.ok(s.aim > 0);
});

test('deslize em curva gera efeito para o lado da curva', () => {
  const right = swipeToShot(swipe([[400, 380], [470, 300], [400, 220]]), screen);
  const left = swipeToShot(swipe([[400, 380], [330, 300], [400, 220]]), screen);
  assert.ok(right.curl > 0 && left.curl < 0);
});

test('deslize curto demais ou para baixo cancela', () => {
  assert.equal(swipeToShot(swipe([[400, 380], [402, 370]]), screen), null);
  assert.equal(swipeToShot(swipe([[400, 200], [400, 380]]), screen), null);
});

// L1 — gestos na defesa
import { classifyDefenseGesture } from '../../src/input/gestures.js';
const def = {
  carrierId: 'opp9', carrierPos: { x: 30, y: 0 },
  defenders: [{ id: 'd4', pos: { x: 36, y: 2 } }, { id: 'd5', pos: { x: 40, y: -8 } }],
  opponents: ['opp9', 'opp10'],
};

test('defesa: tocar no atacante com a bola = bote do defensor mais perto', () => {
  const cmd = classifyDefenseGesture({ ...def, start: { x: 30, y: 0 }, end: { x: 30, y: 0 }, duration: 100, startHit: 'opp9', endHit: 'opp9' });
  assert.deepEqual(cmd, { type: 'press', by: 'd4' });
});

test('defesa: arrastar de um defensor até um ponto = posicionar', () => {
  const cmd = classifyDefenseGesture({ ...def, start: { x: 40, y: -8 }, end: { x: 44, y: -2 }, duration: 400, startHit: 'd5' });
  assert.deepEqual(cmd, { type: 'move', by: 'd5', to: { x: 44, y: -2 } });
});

test('defesa: arrastar de um defensor até o atacante com a bola = bote dele', () => {
  const cmd = classifyDefenseGesture({ ...def, start: { x: 40, y: -8 }, end: { x: 30, y: 0 }, duration: 400, startHit: 'd5', endHit: 'opp9' });
  assert.deepEqual(cmd, { type: 'press', by: 'd5' });
});

test('defesa: arrastar de um defensor até outro atacante = marcar', () => {
  const cmd = classifyDefenseGesture({ ...def, start: { x: 40, y: -8 }, end: { x: 38, y: -12 }, duration: 400, startHit: 'd5', endHit: 'opp10' });
  assert.deepEqual(cmd, { type: 'mark', by: 'd5', target: 'opp10' });
});

test('defesa: toque no vazio não faz nada', () => {
  assert.equal(classifyDefenseGesture({ ...def, start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, duration: 100 }), null);
});
