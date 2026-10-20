import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBall, stepBall, DT, GRAVITY } from '../../src/engine/highlight/physics.js';

const speed = (b) => Math.hypot(b.vel.x, b.vel.y, b.vel.z);
function run(ball, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) stepBall(ball);
  return ball;
}

test('passo fixo de 60 Hz', () => {
  assert.equal(DT, 1 / 60);
});

test('bola rolando perde velocidade e para numa distância realista', () => {
  const ball = createBall({ x: 0, y: 0 });
  ball.vel.x = 10;
  run(ball, 30);
  assert.equal(speed(ball), 0);
  assert.ok(ball.pos.x > 25 && ball.pos.x < 55, `parou em ${ball.pos.x}`);
  assert.equal(ball.pos.z, 0);
});

test('bola no ar cai pela gravidade e volta ao chão no tempo esperado', () => {
  const ball = createBall({ x: 0, y: 0 });
  ball.vel.z = 8;
  let t = 0;
  do { stepBall(ball); t += DT; } while (ball.pos.z > 0 && t < 5);
  const expected = (2 * 8) / GRAVITY;
  assert.ok(Math.abs(t - expected) / expected < 0.1, `voo ${t}s, esperado ${expected}s`);
});

test('quique perde energia e a bola acaba rolando', () => {
  const ball = createBall({ x: 0, y: 0 });
  ball.vel.z = 6;
  ball.vel.x = 5;
  run(ball, 6);
  assert.equal(ball.pos.z, 0);
  assert.equal(ball.vel.z, 0);
});

test('sem efeito a bola vai reta; com efeito ela curva para o lado do giro', () => {
  const straight = createBall({ x: 0, y: 0 });
  straight.vel = { x: 20, y: 0, z: 4 };
  const curled = createBall({ x: 0, y: 0 });
  curled.vel = { x: 20, y: 0, z: 4 };
  curled.spin = 8;
  run(straight, 1);
  run(curled, 1);
  assert.equal(straight.pos.y, 0);
  assert.ok(curled.pos.y > 0.5, `curva ${curled.pos.y}`);
});

test('mesma entrada, mesma trajetória', () => {
  const make = () => { const b = createBall({ x: 1, y: 2 }); b.vel = { x: 12, y: -3, z: 5 }; b.spin = -4; return b; };
  assert.deepEqual(run(make(), 3), run(make(), 3));
});
