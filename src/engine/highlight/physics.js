// Física da bola em passo fixo (metros, segundos). Campo: x no comprimento,
// y na largura, z para cima; centro do campo na origem.
export const DT = 1 / 60;
export const GRAVITY = 9.81;

const AIR_DRAG = 0.05;      // por segundo, proporcional à velocidade
const MAGNUS = 0.01;        // curva lateral por unidade de giro
const SPIN_DECAY = 0.5;     // por segundo
const ROLL_DECEL = 1.0;     // m/s² de atrito ao rolar
const ROLL_DRAG = 0.05;     // por segundo
const BOUNCE = 0.55;        // energia vertical que sobra no quique
const BOUNCE_MIN = 1.5;     // abaixo disso a bola para de quicar
const BOUNCE_GRIP = 0.9;    // velocidade horizontal que sobra no quique
const STOP_SPEED = 0.05;

export function createBall({ x, y, z = 0 }) {
  return { pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, spin: 0, dip: 0 };
}

export function stepBall(ball) {
  const { pos, vel } = ball;
  const airborne = pos.z > 0 || vel.z > 0;
  if (airborne) {
    vel.z -= (GRAVITY + (ball.dip ?? 0)) * DT; // dip: queda extra do chute com efeito por cima
    const drag = 1 - AIR_DRAG * DT;
    vel.x *= drag; vel.y *= drag; vel.z *= drag;
    // Efeito: aceleração perpendicular à velocidade no plano do campo.
    const ax = -vel.y * ball.spin * MAGNUS;
    const ay = vel.x * ball.spin * MAGNUS;
    vel.x += ax * DT; vel.y += ay * DT;
    ball.spin *= 1 - SPIN_DECAY * DT;
  } else {
    const ground = Math.hypot(vel.x, vel.y);
    const next = Math.max(0, ground - (ROLL_DECEL + ROLL_DRAG * ground) * DT);
    const k = next < STOP_SPEED || ground === 0 ? 0 : next / ground;
    vel.x *= k; vel.y *= k;
    if (k === 0) ball.spin = 0;
  }
  pos.x += vel.x * DT; pos.y += vel.y * DT; pos.z += vel.z * DT;
  if (pos.z <= 0 && vel.z <= 0 && airborne) {
    pos.z = 0;
    ball.dip = 0;
    if (-vel.z > BOUNCE_MIN) {
      vel.z = -vel.z * BOUNCE;
      vel.x *= BOUNCE_GRIP; vel.y *= BOUNCE_GRIP;
    } else {
      vel.z = 0;
    }
  }
  return ball;
}
