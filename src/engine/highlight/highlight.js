// Mundo do lance jogável: jogadores, bola e regras, em passo fixo.
// Estado JSON puro: dá para guardar (voltar o lance) e regravar (replay).
import { createRng } from '../rng.js';
import { createBall, stepBall, DT } from './physics.js';
import { createAgent, stepAgent } from './agents.js';
import { FIELD } from './field.js';
import { isKeeper, stepKeeper } from './keeper.js';
import { decideAttack } from './attack-ai.js';

const CONTROL_RADIUS = 6;   // zona de condução (círculo verde)
const DRIBBLE_STEP = 5;     // quanto um arrasto leva o jogador à frente
const BALL_OFFSET = 0.6;    // bola à frente do pé
const TACKLE_RANGE = 1.0;
const TACKLE_BASE = 0.04;   // chance por passo com atributos iguais
const TACKLE_EXPONENT = 3;
const REACH = 1.0;           // alcance para interceptar bola solta
const RECEIVE_REACH = 1.4;   // companheiro dominando o passe (vai ao encontro da bola)
const REACH_HEIGHT = 1.2;
const KICK_IMMUNITY = 0.3;   // s: quem chutou não domina a própria bola logo em seguida
const INTERCEPT_BASE = 0.3;  // chance por passo com atributos iguais
const BLOCK_SHARE = 0.35;    // chute é bem mais difícil de bloquear que passe
const PASS_MAX_ERROR = (12 * Math.PI) / 180; // erro com passe 0; some com passe 100
const SHOT_MAX_ERROR = (14 * Math.PI) / 180; // erro com chute 0, força máxima
const SHOT_SPEED = { min: 12, range: 24 };  // m/s com força 0 e 1
const SHOT_LIFT = 12;                       // m/s verticais com lift 1
const SHOT_SPIN = 12;                       // giro com curl 1
const POST_BOUNCE = 0.6;
const MAX_DURATION = 25;      // s: lance sem desfecho acaba por tempo
const AI_TICK = 0.4;          // s entre decisões do atacante controlado pelo jogo
const DRIBBLE_DONE = 0.4;     // m do ponto de condução para devolver a vez ao jogador

const norm = (v) => { const d = Math.hypot(v.x, v.y) || 1; return { x: v.x / d, y: v.y / d }; };
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function createWorld({ agents, carrierId, attackDir = 1, seed = 1, defendersIdle = false, turnBased = true, mode = 'attack', userSide = null }) {
  const list = agents.map((spec) => ({ ...createAgent(spec), home: { x: spec.x, y: spec.y } }));
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
    // 'attack': o jogador conduz o ataque; 'defense': o jogo ataca e o jogador comanda a defesa.
    mode,
    userSide: userSide ?? carrier.side,
    orders: {},
    aiNext: 0,
    possessionSince: 0,
    controlCenter: { ...carrier.pos },
    controlRadius: CONTROL_RADIUS,
    status: 'live',
    defendersIdle,
    turnBased,
    // Por vez: o tempo só anda depois de um comando e para quando a jogada se completa.
    awaitingInput: turnBased || mode === 'defense',
    lastKick: null,
    events: [],
  };
}

const byId = (w, id) => w.agents.find((a) => a.id === id);

function clampToControl(w, p) {
  const c = w.controlCenter, d = dist(p, c);
  if (d <= w.controlRadius) return p;
  const k = w.controlRadius / d;
  return { x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k };
}

// Erro de direção entre -max e +max, mais provável perto de zero.
const aimError = (rng, max) => (rng.next() + rng.next() - 1) * max;

function rotate(v, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c };
}

function kickBall(w, kicker, vel, spin, lastKick) {
  w.ball.vel = vel;
  w.ball.spin = spin;
  w.carrierId = null;
  w.lastKick = { ...lastKick, from: kicker.id, at: w.t, origin: { x: kicker.pos.x, y: kicker.pos.y } };
}

function pass(w, carrier, receiver, rng) {
  const d = dist(carrier.pos, receiver.pos);
  const speed = Math.min(20, Math.max(9, 8 + 0.4 * d)); // passe rasteiro: 18 m ≈ 15 m/s
  const error = aimError(rng, PASS_MAX_ERROR * (1 - carrier.attrs.passing / 100));
  const dir = rotate(norm({ x: receiver.pos.x - carrier.pos.x, y: receiver.pos.y - carrier.pos.y }), error);
  kickBall(w, carrier, { x: dir.x * speed, y: dir.y * speed, z: 0 }, 0, { type: 'pass', to: receiver.id, error });
}

function shoot(w, carrier, { dir, power = 0.7, curl = 0, lift = 0.2 }, rng) {
  const p = Math.min(1, Math.max(0, power));
  const maxError = SHOT_MAX_ERROR * (1 - carrier.attrs.shooting / 100) * (0.5 + 0.5 * p);
  const error = aimError(rng, maxError);
  const d = rotate(norm(dir), error);
  const speed = SHOT_SPEED.min + SHOT_SPEED.range * p;
  const goal = { x: FIELD.halfLength * w.attackDir, y: 0 };
  kickBall(w, carrier, { x: d.x * speed, y: d.y * speed, z: SHOT_LIFT * Math.min(1, Math.max(0, lift)) },
    SHOT_SPIN * Math.min(1, Math.max(-1, curl)),
    { type: 'shot', error, distance: dist(carrier.pos, goal) });
}

// Bola cruzando a linha de fundo do ataque: gol, trave/travessão ou fora.
function checkGoalLine(w, prev) {
  const b = w.ball, lineX = FIELD.halfLength * w.attackDir;
  const crossed = w.attackDir > 0 ? prev.x < lineX && b.pos.x >= lineX : prev.x > lineX && b.pos.x <= lineX;
  if (!crossed) {
    if (Math.abs(b.pos.y) > FIELD.halfWidth) w.status = 'wide';
    return;
  }
  const k = (lineX - prev.x) / (b.pos.x - prev.x);
  const y = Math.abs(prev.y + (b.pos.y - prev.y) * k), z = prev.z + (b.pos.z - prev.z) * k;
  const R = FIELD.ballRadius, gw = FIELD.goalHalfWidth, gh = FIELD.goalHeight, post = FIELD.postRadius;
  const hitsPost = y > gw - R && y < gw + R + post && z < gh + R;
  const hitsBar = z > gh - R && z < gh + R + post && y < gw + R;
  if (hitsPost || hitsBar) {
    w.events.push({ type: hitsPost ? 'post' : 'bar', t: w.t });
    b.vel.x = -b.vel.x * POST_BOUNCE;
    b.pos.x = lineX - w.attackDir * R;
  } else {
    w.status = y < gw - R && z < gh - R ? 'goal' : 'wide';
  }
}

// Aplica o comando; devolve true se ele virou jogada.
const DEFENSE_ORDERS = new Set(['press', 'move', 'mark']);

function applyDefenseInput(w, input) {
  if (input.type === 'go') return true;
  if (!DEFENSE_ORDERS.has(input.type)) return false;
  const who = byId(w, input.by);
  if (!who || who.side !== w.userSide || isKeeper(who)) return false;
  w.orders[who.id] = { type: input.type, to: input.to, target: input.target };
  return true;
}

function applyInput(w, input, rng) {
  if (!input || w.status !== 'live') return false;
  if (w.mode === 'defense') return applyDefenseInput(w, input);
  const carrier = byId(w, w.carrierId);
  if (!carrier || carrier.side !== w.attackingSide) return false;
  if (input.type === 'dribble') {
    const d = norm(input.dir), len = input.length ?? DRIBBLE_STEP;
    carrier.path = [];
    carrier.target = clampToControl(w, { x: carrier.pos.x + d.x * len, y: carrier.pos.y + d.y * len });
    return true;
  }
  if (input.type === 'pass') {
    const receiver = byId(w, input.to);
    if (!receiver || receiver === carrier || receiver.side !== carrier.side) return false;
    pass(w, carrier, receiver, rng);
    return true;
  }
  if (input.type === 'shoot') {
    shoot(w, carrier, input, rng);
    return true;
  }
  return false;
}

function dribbleDone(w) {
  const c = byId(w, w.carrierId);
  return c && c.side === w.attackingSide && (!c.target || dist(c.pos, c.target) < DRIBBLE_DONE);
}

// Ponto da trajetória da bola mais perto de `p` (só para frente da bola).
function interceptPoint(ball, p) {
  const v = { x: ball.vel.x, y: ball.vel.y }, sp = Math.hypot(v.x, v.y);
  if (sp < 0.5) return { x: ball.pos.x, y: ball.pos.y };
  const u = { x: v.x / sp, y: v.y / sp };
  const along = Math.max(0, (p.x - ball.pos.x) * u.x + (p.y - ball.pos.y) * u.y);
  return { x: ball.pos.x + u.x * along, y: ball.pos.y + u.y * along };
}

// Defesa por funções: o mais perto pressiona, o segundo fecha o caminho do
// gol, os outros seguram a posição puxando um pouco para o lado da bola.
const PRESSERS_ON_LOOSE_BALL = 2;
const COVER_SHARE = 0.4;
const BALL_SIDE_PULL = 0.3;

function holdPosition(w, a) {
  return { x: a.home.x, y: a.home.y + (w.ball.pos.y - a.home.y) * BALL_SIDE_PULL };
}

function moveDefenders(w, carrier) {
  const field = w.agents.filter((a) => a.side !== w.attackingSide && !isKeeper(a));
  const focus = carrier ? carrier.pos : interceptPoint(w.ball, w.ball.pos);
  const ranked = [...field].sort((a, b) => dist(a.pos, focus) - dist(b.pos, focus));
  const goal = { x: FIELD.halfLength * w.attackDir, y: 0 };
  ranked.forEach((a, i) => {
    const order = w.orders[a.id];
    if (order) return followOrder(w, a, order, carrier, goal);
    if (carrier) {
      if (i === 0 && w.mode === 'defense' && a.side === w.userSide) {
        // Cerca: fica entre o atacante e o gol, sem dar o bote sozinho.
        const gx = goal.x - carrier.pos.x, gy = goal.y - carrier.pos.y, gl = Math.hypot(gx, gy) || 1;
        a.target = { x: carrier.pos.x + (gx / gl) * 1.8, y: carrier.pos.y + (gy / gl) * 1.8 };
      } else if (i === 0) a.target = { ...carrier.pos };
      else if (i === 1) a.target = {
        x: carrier.pos.x + (goal.x - carrier.pos.x) * COVER_SHARE,
        y: carrier.pos.y + (goal.y - carrier.pos.y) * COVER_SHARE,
      };
      else a.target = holdPosition(w, a);
    } else {
      a.target = i < PRESSERS_ON_LOOSE_BALL ? interceptPoint(w.ball, a.pos) : holdPosition(w, a);
    }
  });
}

// Atacante do jogo: decide a cada AI_TICK enquanto tem a bola.
function attackByAi(w, rng) {
  const carrier = byId(w, w.carrierId);
  if (!carrier || carrier.side !== w.attackingSide || w.t < w.aiNext) return;
  w.aiNext = w.t + AI_TICK;
  const cmd = decideAttack(w, rng);
  if (cmd.type === 'shoot') shoot(w, carrier, cmd, rng);
  else if (cmd.type === 'pass') pass(w, carrier, byId(w, cmd.to), rng);
  else {
    const len = Math.hypot(cmd.dir.x, cmd.dir.y) || 1;
    carrier.path = [];
    carrier.target = { x: carrier.pos.x + (cmd.dir.x / len) * cmd.length, y: carrier.pos.y + (cmd.dir.y / len) * cmd.length };
  }
}

// Ordem do jogador para um defensor: bote no portador, ir a um ponto, marcar um atacante.
function followOrder(w, a, order, carrier, goal) {
  a.rush = order.type === 'press';
  // Bote: corre para onde o atacante vai estar (lê a jogada), não para onde está.
  const LEAD = 0.4;
  if (order.type === 'press') {
    a.target = carrier ? { x: carrier.pos.x + carrier.vel.x * LEAD, y: carrier.pos.y + carrier.vel.y * LEAD } : interceptPoint(w.ball, a.pos);
  }
  else if (order.type === 'move') a.target = { ...order.to };
  else if (order.type === 'mark') {
    const t = byId(w, order.target);
    // Entre o atacante e o gol, colado nele.
    if (t) a.target = { x: t.pos.x + (goal.x - t.pos.x) * 0.15, y: t.pos.y + (goal.y - t.pos.y) * 0.15 };
  }
}

function moveOffBall(w) {
  const carrier = byId(w, w.carrierId);
  if (!w.defendersIdle) moveDefenders(w, carrier);
  if (!carrier) {
    const receiver = byId(w, w.lastKick?.to);
    if (receiver) receiver.target = interceptPoint(w.ball, receiver.pos); // vai ao encontro da bola
  }
}

function controlLooseBall(w, rng) {
  const b = w.ball;
  if (b.pos.z > REACH_HEIGHT) return;
  const kicker = w.lastKick && w.t - w.lastKick.at < KICK_IMMUNITY ? w.lastKick.from : null;
  const kickerAttrs = byId(w, w.lastKick?.from)?.attrs;
  const skill = (w.lastKick?.type === 'shot' ? kickerAttrs?.shooting : kickerAttrs?.passing) ?? 60;
  // Bola rápida é mais difícil de cortar.
  const speedFactor = Math.min(1, Math.max(0.15, 12 / (Math.hypot(b.vel.x, b.vel.y) || 1)));
  for (const a of w.agents) {
    if (a.id === kicker) continue;
    const d = dist(a.pos, b.pos);
    if (d > (a.side === w.attackingSide ? RECEIVE_REACH : REACH)) continue;
    if (a.side === w.attackingSide) {
      w.carrierId = a.id;
      w.controlCenter = { ...a.pos };
      w.possessionSince = w.t;
      a.target = null;
      if (w.turnBased) w.awaitingInput = true; // dominou: vez do jogador
      return;
    }
    const base = w.lastKick?.type === 'shot' ? INTERCEPT_BASE * BLOCK_SHARE : INTERCEPT_BASE;
    if (rng.next() < Math.min(0.9, base * (a.attrs.defending / skill) * speedFactor)) {
      w.carrierId = a.id;
      w.status = 'lost';
      return;
    }
  }
}

function carryBall(w) {
  const carrier = byId(w, w.carrierId);
  const speed = Math.hypot(carrier.vel.x, carrier.vel.y);
  const dir = speed > 0.2 ? norm(carrier.vel) : { x: w.attackDir, y: 0 };
  w.ball.pos = { x: carrier.pos.x + dir.x * BALL_OFFSET, y: carrier.pos.y + dir.y * BALL_OFFSET, z: 0 };
  w.ball.vel = { x: carrier.vel.x, y: carrier.vel.y, z: 0 };
}

// Bote decidido (ordem do jogador na defesa): uma tentativa; errou, fica caído.
const COMMITTED_BASE = 0.45;
const LUNGE_RANGE = 2.2;     // m: alcance do carrinho
const STUN_TIME = 1.0;

function committedTackle(w, d, carrier, rng) {
  const ratio = d.attrs.defending / carrier.attrs.dribbling;
  delete w.orders[d.id];
  d.rush = false;
  if (rng.next() < Math.min(0.9, Math.max(0.1, COMMITTED_BASE * ratio ** 2))) {
    w.carrierId = d.id;
    w.status = 'lost';
    w.events.push({ type: 'tackle', by: d.id, t: w.t });
  } else {
    d.stunUntil = w.t + STUN_TIME;
    d.target = null;
    d.vel = { x: 0, y: 0 };
    w.events.push({ type: 'missedTackle', by: d.id, t: w.t });
  }
}

function checkTackles(w, rng) {
  const carrier = byId(w, w.carrierId);
  for (const d of w.agents) {
    if (d.side === carrier.side || d.stunUntil > w.t) continue;
    const gap = dist(d.pos, carrier.pos);
    // Na defesa do jogador, só quem recebeu a ordem de bote tenta o desarme (carrinho).
    if (w.mode === 'defense' && d.side === w.userSide) {
      if (gap <= LUNGE_RANGE && w.orders[d.id]?.type === 'press') { committedTackle(w, d, carrier, rng); if (w.status !== 'live') return; }
      continue;
    }
    if (gap > TACKLE_RANGE) continue;
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
  if (applyInput(w, input, rng)) w.awaitingInput = false;
  if (w.awaitingInput) { w.rng = rng.state(); return w; }
  if (w.mode === 'defense') attackByAi(w, rng);
  moveOffBall(w);
  for (const a of w.agents) {
    a.withBall = a.id === w.carrierId;
    if (isKeeper(a) && a.side !== w.attackingSide && stepKeeper(w, a, rng)) continue;
    if (a.stunUntil > w.t) continue; // caído depois de errar o bote
    stepAgent(a);
  }
  if (w.carrierId) {
    carryBall(w);
    checkTackles(w, rng);
  } else {
    const prev = { ...w.ball.pos };
    stepBall(w.ball);
    checkGoalLine(w, prev);
    if (w.status === 'live') controlLooseBall(w, rng);
  }
  w.rng = rng.state();
  w.t += DT;
  if (w.status === 'live' && w.t >= MAX_DURATION) w.status = 'timeout';
  if (w.turnBased && w.status === 'live' && w.carrierId && dribbleDone(w)) w.awaitingInput = true;
  return w;
}
