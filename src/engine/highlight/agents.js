// Movimento dos jogadores no lance: vão ao alvo (ou seguem o caminho da
// corrida) com velocidade e aceleração limitadas por atributos e energia.
import { DT } from './physics.js';

const ARRIVE_RADIUS = 2;   // começa a frear a esta distância do alvo
const REACHED = 0.3;
const RUSH_BOOST = 1.08;
const WITH_BALL = 0.85;       // conduzindo, corre menos que sem a bola

const energyFactor = (e) => 0.6 + 0.4 * (e / 100);

export const maxSpeed = (a) => (5 + (a.attrs.pace / 99) * 4) * energyFactor(a.energy) * (a.withBall ? WITH_BALL : 1);
const maxAccel = (a) => (6 + (a.attrs.physical / 99) * 4) * energyFactor(a.energy);

export function createAgent({ id, side, x, y, attrs, energy = 100, role = null }) {
  return { id, side, role, attrs, energy, pos: { x, y }, vel: { x: 0, y: 0 }, target: null, path: [] };
}

export function stepAgent(a) {
  if (!a.target && a.path.length) a.target = a.path.shift();
  let desiredX = 0, desiredY = 0;
  if (a.target) {
    const dx = a.target.x - a.pos.x, dy = a.target.y - a.pos.y;
    const d = Math.hypot(dx, dy);
    if (d < REACHED && a.path.length) {
      a.target = a.path.shift();
    } else if (d > 1e-6) {
      // No bote (rush) o jogador entra em velocidade, sem frear perto do alvo.
      const speed = a.rush ? maxSpeed(a) * RUSH_BOOST : maxSpeed(a) * Math.min(1, d / ARRIVE_RADIUS);
      desiredX = (dx / d) * speed; desiredY = (dy / d) * speed;
    }
  }
  // Muda a velocidade em direção à desejada, no máximo maxAccel por segundo.
  let ax = desiredX - a.vel.x, ay = desiredY - a.vel.y;
  const dv = Math.hypot(ax, ay), limit = maxAccel(a) * DT;
  if (dv > limit) { ax *= limit / dv; ay *= limit / dv; }
  a.vel.x += ax; a.vel.y += ay;
  a.pos.x += a.vel.x * DT; a.pos.y += a.vel.y * DT;
  return a;
}
