// IA do goleiro: fecha o ângulo entre a bola e o gol, reage ao chute com
// atraso pelo atributo, mergulha no ponto previsto e tenta a defesa uma vez.
import { DT } from './physics.js';
import { FIELD } from './field.js';

const BOX = { depth: 16.5, halfWidth: 20.16 };
const MAX_OFF_LINE = 3;        // m que sai do gol para fechar o ângulo
const STAND_REACH = 0.8;
const DIVE_REACH = 1.2;        // somado ao alcance em pé, escala com o atributo
const SAVE_HEIGHT = 2.6;

const g = (gk) => gk.attrs.goalkeeping / 99;
const goalOf = (w) => ({ x: FIELD.halfLength * w.attackDir, y: 0 });

export const isKeeper = (a) => a.role === 'GK';

function clampToBox(w, p) {
  const line = FIELD.halfLength * w.attackDir;
  const depth = Math.min(BOX.depth, Math.abs(line - p.x));
  return { x: line - w.attackDir * depth, y: Math.max(-BOX.halfWidth, Math.min(BOX.halfWidth, p.y)) };
}

export function keeperPosition(w) {
  const goal = goalOf(w), b = w.ball.pos;
  const d = Math.hypot(b.x - goal.x, b.y - goal.y) || 1;
  const off = Math.min(MAX_OFF_LINE, d * 0.12);
  return clampToBox(w, { x: goal.x + ((b.x - goal.x) / d) * off, y: goal.y + ((b.y - goal.y) / d) * off });
}

const shotIncoming = (w) =>
  w.lastKick?.type === 'shot' && !w.carrierId && Math.sign(w.ball.vel.x) === w.attackDir;

// Atualiza o goleiro neste passo. Devolve true se ele cuidou do próprio movimento (mergulho).
export function stepKeeper(w, gk, rng) {
  if (!shotIncoming(w)) { gk.target = keeperPosition(w); return false; }
  const dive = (w.dive ??= { by: gk.id, tried: false });
  const reaction = 0.25 - 0.15 * g(gk);
  if (w.t - w.lastKick.at < reaction) return false;
  // Ponto onde a bola cruza a linha do goleiro (previsão reta, sem o efeito).
  const b = w.ball, k = (gk.pos.x - b.pos.x) / (b.vel.x || 1e-6);
  const aimY = k > 0 ? b.pos.y + b.vel.y * k : b.pos.y;
  const speed = 5 + 3 * g(gk), dy = aimY - gk.pos.y;
  gk.pos.y += Math.sign(dy) * Math.min(Math.abs(dy), speed * DT);
  gk.vel = { x: 0, y: 0 };
  if (!dive.tried) trySave(w, gk, rng, dive);
  return true;
}

function trySave(w, gk, rng, dive) {
  const b = w.ball;
  const reach = STAND_REACH + DIVE_REACH * g(gk);
  if (Math.hypot(b.pos.x - gk.pos.x, b.pos.y - gk.pos.y) > reach || b.pos.z > SAVE_HEIGHT) return;
  dive.tried = true;
  const ballSpeed = Math.hypot(b.vel.x, b.vel.y, b.vel.z);
  const p = Math.min(0.97, Math.max(0, (gk.attrs.goalkeeping / 100) * (1.25 - (ballSpeed - 14) / 40)));
  if (rng.next() < p) {
    w.status = 'saved';
    b.vel.x = -b.vel.x * 0.3; b.vel.y *= 0.3; b.vel.z = Math.abs(b.vel.z) * 0.3;
  }
}
