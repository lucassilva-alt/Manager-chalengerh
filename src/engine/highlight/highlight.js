// Mundo do lance jogável: jogadores, bola e regras, em passo fixo.
// Estado JSON puro: dá para guardar (voltar o lance) e regravar (replay).
import { createRng } from '../rng.js';
import { createBall, stepBall } from './physics.js';
import { createAgent, stepAgent } from './agents.js';

const CONTROL_RADIUS = 6;   // zona de condução (círculo verde)
const DRIBBLE_STEP = 5;     // quanto um arrasto leva o jogador à frente
const BALL_OFFSET = 0.6;    // bola à frente do pé
const TACKLE_RANGE = 1.0;
const TACKLE_BASE = 0.04;   // chance por passo com atributos iguais
const TACKLE_EXPONENT = 3;

const norm = (v) => { const d = Math.hypot(v.x, v.y) || 1; return { x: v.x / d, y: v.y / d }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createWorld({ agents, carrierId, attackDir = 1, seed = 1 }) {
  const list = agents.map(createAgent);
  const carrier = list.find((a) => a.id === carrierId);
  const ball = createBall({ x: carrier.pos.x + BALL_OFFSET * attackDir, y: carrier.pos.y });
  return {
    t: 0,
    rng: seed >>> 0,
    attackDir,
    agents: list,
    ball,
    carrierId,
    attackingSide: carrier.side,
    controlCenter: { ...carrier.pos },
    controlRadius: CONTROL_RADIUS,
    status: 'live',
  };
}

const byId = (w, id) => w.agents.find((a) => a.id === id);

function clampToControl(w, p) {
  const c = w.controlCenter, d = dist(p, c);
  if (d <= w.controlRadius) return p;
  const k = w.controlRadius / d;
  return { x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k };
}

function applyInput(w, input) {
  if (!input || w.status !== 'live') return;
  const carrier = byId(w, w.carrierId);
  if (input.type === 'dribble' && carrier?.side === w.attackingSide) {
    const d = norm(input.dir), len = input.length ?? DRIBBLE_STEP;
    carrier.path = [];
    carrier.target = clampToControl(w, { x: carrier.pos.x + d.x * len, y: carrier.pos.y + d.y * len });
  }
}

function defend(w) {
  const carrier = byId(w, w.carrierId);
  for (const a of w.agents) {
    if (a.side !== w.attackingSide && carrier) a.target = { ...carrier.pos };
  }
}

function carryBall(w) {
  const carrier = byId(w, w.carrierId);
  const speed = Math.hypot(carrier.vel.x, carrier.vel.y);
  const dir = speed > 0.2 ? norm(carrier.vel) : { x: w.attackDir, y: 0 };
  w.ball.pos = { x: carrier.pos.x + dir.x * BALL_OFFSET, y: carrier.pos.y + dir.y * BALL_OFFSET, z: 0 };
  w.ball.vel = { x: carrier.vel.x, y: carrier.vel.y, z: 0 };
}

function checkTackles(w, rng) {
  const carrier = byId(w, w.carrierId);
  for (const d of w.agents) {
    if (d.side === carrier.side || dist(d.pos, carrier.pos) > TACKLE_RANGE) continue;
    const ratio = d.attrs.defending / carrier.attrs.dribbling;
    if (rng.next() < Math.min(0.5, TACKLE_BASE * ratio ** TACKLE_EXPONENT)) {
      w.carrierId = d.id;
      w.status = 'lost';
      return;
    }
  }
}

export function stepWorld(w, input = null) {
  if (w.status !== 'live') return w;
  const rng = createRng(w.rng);
  applyInput(w, input);
  defend(w);
  for (const a of w.agents) stepAgent(a);
  if (w.carrierId) carryBall(w);
  else stepBall(w.ball);
  if (w.carrierId) checkTackles(w, rng);
  w.rng = rng.state();
  w.t += 1 / 60;
  return w;
}
