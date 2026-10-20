// Regras de gesto do lance (puras, sem DOM). A tela converte toque/mouse em
// pontos do campo e chama classifyGesture; o close do chute usa swipeToShot.
const TAP_MOVE = 0.8;        // m
const TAP_TIME = 350;        // ms
const CARRIER_GRAB = 2;      // m: arrasto que começa perto do jogador com a bola

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function classifyGesture({ start, end, duration, startHit, endHit, goalHit, carrierId, carrierPos, teammates }) {
  const moved = dist(start, end);
  const isMate = (id) => id && id !== carrierId && teammates.includes(id);
  if (moved < TAP_MOVE && duration < TAP_TIME) {
    if (isMate(startHit)) return { type: 'pass', to: startHit };
    if (goalHit) return { type: 'aimShot' };
    return null;
  }
  const fromCarrier = startHit === carrierId || dist(start, carrierPos) < CARRIER_GRAB;
  if (!fromCarrier) return null;
  if (isMate(endHit)) return { type: 'pass', to: endHit };
  return { type: 'dribble', dir: { x: end.x - start.x, y: end.y - start.y }, length: moved };
}

// Deslize na tela do chute (pixels; y da tela cresce para baixo).
// aim: -1 (esquerda) a 1 (direita); curl: lado para onde a curva do dedo puxou.
export function swipeToShot(points, { width, height }) {
  if (points.length < 2) return null;
  const a = points[0], b = points.at(-1);
  const dx = b.x - a.x, up = a.y - b.y, chord = Math.hypot(dx, up);
  if (up < 0.08 * height || chord < 0.1 * height) return null;
  let dev = 0;
  for (const p of points.slice(1, -1)) {
    const d = (dx * (p.y - a.y) - (-up) * (p.x - a.x)) / chord;
    if (Math.abs(d) > Math.abs(dev)) dev = d;
  }
  const power = clamp(up / (0.55 * height), 0.15, 1);
  return {
    power,
    aim: clamp(dx / (0.35 * width), -1, 1),
    curl: Math.abs(dev) < 0.04 * chord ? 0 : clamp(dev / (0.25 * chord), -1, 1),
    lift: 0.1 + 0.2 * power,
  };
}
