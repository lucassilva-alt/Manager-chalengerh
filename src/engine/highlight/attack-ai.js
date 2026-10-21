// IA do atacante no lance de defesa: decide, a cada tique, entre conduzir,
// passar ou chutar. Devolve um comando; quem executa é o mundo do lance.
import { FIELD } from './field.js';

const SHOOT_RANGE = 22;      // m do gol para arriscar com espaço
const CLOSE_RANGE = 14;      // m: chuta mesmo pressionado
const PRESSURE = 2.4;        // m: defensor em cima (bote) → procura o passe
const DEFENDER_RUN = 3.5;    // m/s que o defensor fecha a linha enquanto a bola viaja
const SPACE = 2;             // m livres para chutar de longe
const DRIBBLE_STEP = 5;
const OPEN_LANE = 1.2;        // m livres na linha (já descontada a corrida do defensor)
const SIDESTEP = 1.2;         // quanto o drible foge do defensor
const RECEIVER_SPACE = 3;     // m livres em volta de quem recebe
const TOUCHLINE_MARGIN = 8;   // m: não passa para quem está colado na lateral
const MAX_POSSESSION = 6;    // s com a bola até forçar a finalização

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Distância do ponto p ao segmento a→b.
function distToSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function decideAttack(w, rng) {
  const carrier = w.agents.find((a) => a.id === w.carrierId);
  const goal = { x: FIELD.halfLength * w.attackDir, y: 0 };
  const defenders = w.agents.filter((a) => a.side !== w.attackingSide);
  const field = defenders.filter((a) => a.role !== 'GK');
  const keeper = defenders.find((a) => a.role === 'GK');
  const nearest = Math.min(...field.map((d) => dist(d.pos, carrier.pos)));
  const toGoal = dist(carrier.pos, goal);
  const held = w.t - (w.possessionSince ?? 0);

  if ((toGoal < SHOOT_RANGE && nearest > SPACE) || toGoal < CLOSE_RANGE || held > MAX_POSSESSION) {
    // Canto oposto ao goleiro.
    const side = keeper && keeper.pos.y > 0 ? -1 : 1;
    const aimY = side * (FIELD.goalHalfWidth - 0.6 - rng.next() * 0.8);
    return {
      type: 'shoot', dir: { x: goal.x - carrier.pos.x, y: aimY - carrier.pos.y },
      power: 0.7 + rng.next() * 0.25, lift: 0.08 + rng.next() * 0.1, curl: (rng.next() - 0.5) * 0.6,
    };
  }

  if (nearest < PRESSURE) {
    // Companheiro mais adiantado com a linha de passe mais livre.
    let best = null, bestScore = -Infinity;
    for (const mate of w.agents) {
      if (mate.side !== w.attackingSide || mate.id === carrier.id || mate.role === 'GK') continue;
      // Onde o recebedor vai estar quando a bola chegar (~16 m/s de passe).
      const travel = dist(carrier.pos, mate.pos) / 16;
      const at = { x: mate.pos.x + mate.vel.x * travel, y: mate.pos.y + mate.vel.y * travel };
      // Linha livre descontando o quanto cada defensor corre até a bola chegar.
      const lane = Math.min(...field.map((d) => distToSegment(d.pos, carrier.pos, at) - DEFENDER_RUN * travel));
      const space = Math.min(...field.map((d) => Math.min(dist(d.pos, mate.pos), dist(d.pos, at))));
      if (space < RECEIVER_SPACE) continue; // recebedor marcado
      if (Math.abs(at.y) > FIELD.halfWidth - TOUCHLINE_MARGIN) continue; // bola sairia pela lateral
      const score = lane * 2 + (mate.pos.x - carrier.pos.x) * w.attackDir * 0.3 - dist(mate.pos, carrier.pos) * 0.15;
      if (lane > OPEN_LANE && score > bestScore) { best = mate; bestScore = score; }
    }
    if (best) return { type: 'pass', to: best.id };
  }

  // Conduz rumo ao gol, desviando do defensor mais perto.
  const threat = field.reduce((a, b) => (dist(a.pos, carrier.pos) < dist(b.pos, carrier.pos) ? a : b));
  const away = { x: carrier.pos.x - threat.pos.x, y: carrier.pos.y - threat.pos.y };
  const awayLen = Math.hypot(away.x, away.y) || 1;
  const toward = { x: goal.x - carrier.pos.x, y: goal.y - carrier.pos.y };
  const towardLen = Math.hypot(toward.x, toward.y) || 1;
  const k = nearest < PRESSURE ? SIDESTEP : 0.5;
  const dir = { x: toward.x / towardLen + (away.x / awayLen) * k, y: toward.y / towardLen + (away.y / awayLen) * k };
  return { type: 'dribble', dir, length: DRIBBLE_STEP };
}
