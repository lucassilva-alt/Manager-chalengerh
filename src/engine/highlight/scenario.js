// Monta o lance jogável a partir da chance pendente da partida e devolve o
// desfecho para ela. O time do jogador sempre ataca para x positivo.
import { createWorld } from './highlight.js';
import { resolveHighlight } from '../match-sim.js';
import { createRng } from '../rng.js';

// Profundidade (x) de cada posição no ataque e na defesa; a largura (y)
// se espalha pelo número de jogadores na mesma posição.
const ATTACK_X = { GOL: -45, ZAG: -4, LAT: 8, VOL: 10, MEI: 20, ATA: 30 };
const DEFEND_X = { GOL: 51.5, ZAG: 40, LAT: 38, VOL: 33, MEI: 26, ATA: 10 };
const SPREAD = { GOL: 0, ZAG: 9, LAT: 27, VOL: 7, MEI: 20, ATA: 8 };
const RUN_TO = { ATA: { x: 44, spread: 6 }, MEI: { x: 38, spread: 16 } };
const CARRIER_START = { x: 24, y: 0 };

const other = (side) => (side === 'home' ? 'away' : 'home');

function slots(lineup, depth) {
  const byPos = {};
  for (const p of lineup) (byPos[p.pos] ??= []).push(p);
  return lineup.map((p) => {
    const group = byPos[p.pos], i = group.indexOf(p), n = group.length;
    const y = n === 1 ? 0 : -SPREAD[p.pos] + (2 * SPREAD[p.pos] * i) / (n - 1);
    return { player: p, x: depth[p.pos], y, index: i, count: n };
  });
}

function toAgent(m, side, slot) {
  const p = slot.player;
  return {
    id: p.id, side, x: slot.x, y: slot.y, attrs: p.attrs,
    energy: m.energy[p.id] ?? 100,
    role: p.pos === 'GOL' ? 'GK' : null,
  };
}

// Pênalti: batedor na marca, goleiro na linha, o resto fora da área.
const PENALTY_SPOT = 11;
const BOX_EDGE = 18.5;

function penaltyLayout(m, side, playerId) {
  const goalX = 52.5;
  const spread = (i, n, w) => (n === 1 ? 0 : -w + (2 * w * i) / (n - 1));
  const att = m[side].lineup, def = m[other(side)].lineup;
  const attField = att.filter((p) => p.id !== playerId && p.pos !== 'GOL');
  const defField = def.filter((p) => p.pos !== 'GOL');
  return [
    ...att.map((p) => {
      if (p.id === playerId) return toAgent(m, side, { player: p, x: goalX - PENALTY_SPOT, y: 0 });
      if (p.pos === 'GOL') return toAgent(m, side, { player: p, x: -45, y: 0 });
      const i = attField.indexOf(p);
      return toAgent(m, side, { player: p, x: goalX - BOX_EDGE - 1.5 - (i % 2) * 2, y: spread(i, attField.length, 18) });
    }),
    ...def.map((p) => {
      if (p.pos === 'GOL') return toAgent(m, other(side), { player: p, x: goalX - 0.3, y: 0 });
      const i = defField.indexOf(p);
      return toAgent(m, other(side), { player: p, x: goalX - BOX_EDGE - 0.5 - (i % 2) * 2, y: spread(i, defField.length, 18) + 0.8 });
    }),
  ];
}

// Escolha de canto (-1, 0, 1): canto mais provável que o meio.
function pickSide(rng) {
  const r = rng.next();
  return r < 0.42 ? -1 : r < 0.58 ? 0 : 1;
}

function buildPenalty(m, { seed }) {
  const { side, playerId } = m.pending;
  const defense = m.userSide && side !== m.userSide;
  const w = createWorld({
    agents: penaltyLayout(m, side, playerId), carrierId: playerId, attackDir: 1, seed,
    defendersIdle: true, turnBased: true,
    mode: defense ? 'penaltyDefense' : 'penalty', userSide: m.userSide ?? side,
  });
  // Escolhas do jogo sorteadas já no começo (determinístico para replay e voltar o lance).
  w.penalty = penaltyChoices(seed ^ 0x9e3779b9);
  w.awaitingInput = true;
  return w;
}

function penaltyChoices(seed) {
  const rng = createRng(seed);
  return { keeperDive: pickSide(rng), shotSide: pickSide(rng), diveDir: null, power: 0.75 + rng.next() * 0.2, aimNoise: (rng.next() - 0.5) * 0.6 };
}

export function buildScenario(m, { seed = m.rng, defendersIdle = false, turnBased = true } = {}) {
  if (m.pending.kind === 'penalty') return buildPenalty(m, { seed });
  const { side, playerId } = m.pending;
  const attackers = slots(m[side].lineup, ATTACK_X).map((s) => {
    if (s.player.id === playerId) return { ...s, ...CARRIER_START };
    return s;
  });
  const defenders = slots(m[other(side)].lineup, DEFEND_X).map((s) => ({ ...s, y: -s.y }));
  const agents = [
    ...attackers.map((s) => toAgent(m, side, s)),
    ...defenders.map((s) => toAgent(m, other(side), s)),
  ];
  // Chance do adversário: lance de defesa (o jogo ataca, o jogador comanda a defesa).
  const defense = m.userSide && side !== m.userSide;
  const w = createWorld({
    agents, carrierId: playerId, attackDir: 1, seed, defendersIdle,
    turnBased: defense ? false : turnBased,
    mode: defense ? 'defense' : 'attack',
    userSide: m.userSide ?? side,
  });
  // Corridas dos companheiros (linhas tracejadas na tela).
  for (const s of attackers) {
    const run = RUN_TO[s.player.pos];
    if (!run || s.player.id === playerId) continue;
    const y = s.count === 1 ? 0 : -run.spread + (2 * run.spread * s.index) / (s.count - 1);
    w.agents.find((a) => a.id === s.player.id).path = [{ x: run.x, y }];
  }
  return w;
}

// Começa o lance guardando uma cópia para o "voltar o lance".
export function startHighlight(m, opts) {
  const w = buildScenario(m, opts);
  m.highlightStart = structuredClone(w);
  return w;
}

// Devolve o lance do começo (1 vez por partida) ou null.
export function rewindHighlight(m) {
  if (!m.highlightStart || m.rewindsLeft <= 0) return null;
  m.rewindsLeft -= 1;
  const w = structuredClone(m.highlightStart);
  // Pênalti: novo sorteio dos cantos, senão daria para ver o pulo e bater do outro lado.
  if (w.penalty) w.penalty = penaltyChoices((w.rng ^ 0x85ebca6b ^ (m.rewindsLeft + 1) * 2654435761) >>> 0);
  return w;
}

export function outcomeOf(w) {
  if (w.status === 'goal') return 'goal';
  if (w.status === 'saved') return 'saved';
  return 'wide';
}

export function finishHighlight(m, w) {
  m.highlightStart = null;
  resolveHighlight(m, { outcome: outcomeOf(w) });
}
