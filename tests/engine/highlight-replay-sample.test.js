// L5: amostra do replay entre dois quadros gravados (câmera lenta suave).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { frameAt } from '../../src/engine/highlight/replay.js';

const frames = [
  { t: 0, ball: { x: 0, y: 0, z: 0 }, agents: [{ id: 'a', x: 0, y: 0 }] },
  { t: 1, ball: { x: 10, y: 2, z: 4 }, agents: [{ id: 'a', x: 4, y: 0 }] },
  { t: 2, ball: { x: 20, y: 4, z: 0 }, agents: [{ id: 'a', x: 4, y: 3 }] },
];

test('replay: no meio de dois quadros a posição é interpolada', () => {
  const f = frameAt(frames, 0.5);
  assert.deepEqual(f.ball, { x: 5, y: 1, z: 2 });
  assert.deepEqual(f.agents[0].pos, { x: 2, y: 0 });
});

test('replay: velocidade vem da diferença entre os quadros', () => {
  const f = frameAt(frames, 1.5);
  assert.deepEqual(f.agents[0].vel, { x: 0, y: 3 });
  assert.deepEqual(f.ballVel, { x: 10, y: 2, z: -4 });
});

test('replay: fora do intervalo gravado fica no primeiro ou no último quadro', () => {
  assert.equal(frameAt(frames, -3).ball.x, 0);
  assert.equal(frameAt(frames, 9).ball.x, 20);
  assert.equal(frameAt([], 1), null);
});
