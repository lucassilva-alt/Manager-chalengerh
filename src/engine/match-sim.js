// Simulação da partida minuto a minuto. O estado é JSON puro (salvar,
// restaurar, voltar o lance); o sorteio vive em `rng` como número.
import { createRng } from './rng.js';
import { teamStrength } from './teams.js';
import { fitFor } from './formations.js';

const HALF_END = { first: 45, second: 90 };
const SIDES = ['home', 'away'];
const other = (side) => (side === 'home' ? 'away' : 'home');

// Calibrado para ~2,5 gols por jogo entre times iguais (ver match-events.test.js).
const CHANCE_PER_MINUTE = 0.065;
const CHANCE_EXPONENT = 2;
const CHANCE_KINDS = [ // [limite acumulado, tipo, conversão base]
  [0.03, 'penalty', 0.76],
  [0.13, 'freekick', 0.09],
  [0.28, 'corner', 0.06],
  [1, 'open', 0.24],
];
const SHOOTER_WEIGHT = { ATA: 5, MEI: 3, VOL: 1.5, LAT: 1, ZAG: 0.8, GOL: 0 };

function pickWeighted(rng, items, weight) {
  const total = items.reduce((s, it) => s + weight(it), 0);
  let r = rng.next() * total;
  for (const it of items) if ((r -= weight(it)) < 0) return it;
  return items.at(-1);
}

function pickShooter(rng, team, kind) {
  if (kind === 'penalty') {
    return team.lineup.reduce((best, p) => (p.attrs.shooting > best.attrs.shooting ? p : best));
  }
  return pickWeighted(rng, team.lineup, (p) => SHOOTER_WEIGHT[p.pos] * p.attrs.shooting);
}

// Ritmo 5 = neutro. Foco troca ataque por defesa.
const FOCUS = {
  balanced: { attack: 1, defense: 1 },
  attack: { attack: 1.08, defense: 0.94 },
  defense: { attack: 0.94, defense: 1.08 },
};
const workRateFactor = (wr) => 0.9 + wr * 0.02;
// Energia perdida por minuto: ~0,38 no ritmo 5 com físico 60.
const ENERGY_DRAIN = 0.55;

// Moral média do time: 70 = neutro; 95 rende ~7% a mais, 20 ~15% a menos.
const MORALE_NEUTRAL = 70, MORALE_WEIGHT = 0.3;
function moraleFactor(m, side) {
  const team = m[side].lineup;
  if (!team.length) return 1;
  const avg = team.reduce((s, p) => s + (m.morale[p.id] ?? MORALE_NEUTRAL), 0) / team.length;
  return 1 + ((avg - MORALE_NEUTRAL) / 100) * MORALE_WEIGHT;
}

// Conversa no intervalo: efeito por placar (perdendo/empatando/ganhando) e traço.
const TALK = {
  praise: { losing: -2, drawing: 4, winning: 8 },
  demand: { losing: 8, drawing: 4, winning: -3 },
  calm: { losing: 3, drawing: 3, winning: 3 },
};
const TRAIT_TALK = {
  praise: { Vaidoso: 4, Preguiçoso: -3 },
  demand: { Profissional: 3, 'Líder': 2, Ambicioso: 2 },
  calm: { Temperamental: 4, Tranquilo: 1 },
};
const TEMPER_RISK = 0.5, TEMPER_DROP = 10;

export function halftimeTalk(m, side, tone) {
  if (m.phase !== 'halftime' || m.talked[side] || !TALK[tone]) return false;
  m.talked[side] = true;
  const diff = m.score[side] - m.score[other(side)];
  const state = diff < 0 ? 'losing' : diff > 0 ? 'winning' : 'drawing';
  const rng = createRng(m.discRng);
  let total = 0;
  for (const p of m[side].lineup) {
    const traits = p.traits ?? [];
    let delta = TALK[tone][state];
    for (const t of traits) delta += TRAIT_TALK[tone][t] ?? 0;
    if (tone === 'demand' && traits.includes('Temperamental') && rng.next() < TEMPER_RISK) delta = -TEMPER_DROP;
    m.morale[p.id] = Math.max(0, Math.min(100, (m.morale[p.id] ?? MORALE_NEUTRAL) + delta));
    total += delta;
  }
  m.discRng = rng.state();
  m.events.push({ minute: m.minute, type: 'talk', side, tone, effect: Math.round(total / Math.max(1, m[side].lineup.length)) });
  return true;
}

// Cada jogador a menos (expulso) tira força do time todo.
const MAN_DOWN = 0.07;

function effectiveStrength(m, side) {
  const { workRate, focus } = m.tactics[side];
  const base = teamStrength(m[side], { energy: m.energy });
  const missing = Math.max(0, (m.startingSize?.[side] ?? m[side].lineup.length) - m[side].lineup.length);
  const short = 1 - MAN_DOWN * missing;
  const spirit = moraleFactor(m, side);
  return {
    attack: base.attack * workRateFactor(workRate) * FOCUS[focus].attack * short * spirit,
    defense: base.defense * workRateFactor(workRate) * FOCUS[focus].defense * short * spirit,
  };
}
export const matchStrength = effectiveStrength;

// Cartões e lesões: sorteio próprio, para não mexer na sequência das chances.
// Calibrado para o Brasileirão: ~5 amarelos e ~0,25 vermelho por jogo.
const YELLOW_PER_MINUTE = 0.026;   // por time, no ritmo 5
const STRAIGHT_RED_PER_MINUTE = 0.0005;
const INJURY_PER_MINUTE = 0.0017;  // por time
const INJURED_ENERGY = 30;
const BOOKED_CARE = 0.25;
const FOUL_WEIGHT = { ZAG: 3, VOL: 3, LAT: 2, MEI: 1.5, ATA: 1, GOL: 0.3 };

// Substituições: 5 trocas em até 3 paradas; trocas no intervalo não gastam parada.
const MAX_SUBS = 5, MAX_STOPS = 3;

export function substitute(m, side, outId, inId) {
  if (m.phase === 'ended') return false;
  const s = m.subs[side], team = m[side];
  const out = team.lineup.find((p) => p.id === outId);
  const inc = (team.bench ?? []).find((p) => p.id === inId);
  if (!out || !inc || s.count >= MAX_SUBS) return false;
  const stop = m.phase === 'halftime' ? null : m.minute;
  const newStop = stop !== null && !s.stops.includes(stop);
  if (newStop && s.stops.length >= MAX_STOPS) return false;
  if (newStop) s.stops.push(stop);
  s.count += 1;
  const natural = inc.natural ?? inc.pos;
  const placed = { ...inc, pos: out.pos, natural, fit: fitFor(inc, out.pos) };
  m[side] = {
    ...team,
    lineup: team.lineup.map((p) => (p.id === outId ? placed : p)),
    bench: team.bench.filter((p) => p.id !== inId),
  };
  m.energy[inc.id] = 100;
  m.ratings[inc.id] = 6.5;
  m.subbedOff.push(out);
  m.subbedOn.push(inc.id);
  m.events.push({ minute: m.minute, type: 'sub', side, playerId: inc.id, outId });
  return true;
}

// Time do jogo: tira lesionado na hora; do minuto 60 em diante, os mais cansados.
const AI_SUB_FROM = 60, TIRED = 78, AI_SUBS_PER_STOP = 2;

function aiSubstitutions(m, side) {
  const team = m[side];
  if (!team.bench?.length || m.subs[side].count >= MAX_SUBS) return;
  const injured = team.lineup.filter((p) => m.injuries[p.id]);
  const tired = m.minute >= AI_SUB_FROM
    ? team.lineup.filter((p) => p.pos !== 'GOL' && !m.injuries[p.id] && m.energy[p.id] < TIRED && !m.subbedOn.includes(p.id))
      .sort((a, b) => m.energy[a.id] - m.energy[b.id]).slice(0, AI_SUBS_PER_STOP)
    : [];
  for (const out of [...injured, ...tired]) {
    const options = m[side].bench.filter((p) => (p.pos === 'GOL') === (out.pos === 'GOL'));
    if (!options.length) continue;
    const best = options.reduce((a, b) => (fitFor(b, out.pos) > fitFor(a, out.pos) ? b : a));
    if (!substitute(m, side, out.id, best.id)) return;
  }
}

export function bookPlayer(m, side, playerId, card) {
  const yellows = (m.cards[playerId] ?? 0) + (card === 'yellow' ? 1 : 0);
  m.cards[playerId] = yellows;
  if (card === 'yellow') {
    m.events.push({ minute: m.minute, type: 'yellow', side, playerId });
    bumpRating(m, playerId, -0.3);
    if (yellows < 2) return;
  }
  m.events.push({ minute: m.minute, type: 'red', side, playerId, ...(card === 'yellow' ? { second: true } : {}) });
  bumpRating(m, playerId, -1.5);
  m.sentOff.push(m[side].lineup.find((p) => p.id === playerId));
  m[side] = { ...m[side], lineup: m[side].lineup.filter((p) => p.id !== playerId) };
}

function simulateDiscipline(m) {
  const rng = createRng(m.discRng);
  for (const side of SIDES) {
    const team = m[side];
    const aggression = workRateFactor(m.tactics[side].workRate);
    const outfield = team.lineup.filter((p) => p.pos !== 'GOL');
    if (rng.next() < YELLOW_PER_MINUTE * aggression && team.lineup.length) {
      // Amarelado joga com mais cuidado.
      bookPlayer(m, side, pickWeighted(rng, team.lineup, (p) => FOUL_WEIGHT[p.pos] * (m.cards[p.id] ? BOOKED_CARE : 1)).id, 'yellow');
    } else if (rng.next() < STRAIGHT_RED_PER_MINUTE * aggression && outfield.length) {
      bookPlayer(m, side, pickWeighted(rng, outfield, (p) => FOUL_WEIGHT[p.pos]).id, 'red');
    }
    if (rng.next() < INJURY_PER_MINUTE) {
      const fit = m[side].lineup.filter((p) => !m.injuries[p.id]);
      if (fit.length) {
        const p = fit[Math.floor(rng.next() * fit.length)];
        const weeks = 1 + Math.floor(rng.next() ** 2 * 8); // maioria leve
        m.injuries[p.id] = { weeks, minute: m.minute };
        m.energy[p.id] = Math.min(m.energy[p.id], INJURED_ENERGY);
        m.events.push({ minute: m.minute, type: 'injury', side, playerId: p.id, weeks });
      }
    }
  }
  m.discRng = rng.state();
}

function drainEnergy(m) {
  for (const side of SIDES) {
    const effort = 0.5 + m.tactics[side].workRate / 10;
    for (const p of m[side].lineup) {
      const loss = ENERGY_DRAIN * effort * (1 - p.attrs.physical / 200);
      m.energy[p.id] = Math.max(0, m.energy[p.id] - loss);
      if (m.injuries[p.id]) m.energy[p.id] = Math.min(m.energy[p.id], INJURED_ENERGY);
    }
  }
}

const clampRating = (r) => Math.round(Math.min(10, Math.max(3, r)) * 10) / 10;
function bumpRating(m, id, delta) { m.ratings[id] = clampRating(m.ratings[id] + delta); }

function rateChance(m, side, shooterId, outcome) {
  if (outcome === 'goal') {
    bumpRating(m, shooterId, 1.0);
    for (const p of m[side].lineup) if (p.id !== shooterId) bumpRating(m, p.id, 0.1);
    for (const p of m[other(side)].lineup) {
      if (p.pos === 'GOL') bumpRating(m, p.id, -0.3);
      else if (p.pos === 'ZAG' || p.pos === 'LAT') bumpRating(m, p.id, -0.1);
    }
  } else if (outcome === 'saved') {
    bumpRating(m, shooterId, 0.1);
    const gk = m[other(side)].lineup.find((p) => p.pos === 'GOL');
    if (gk) bumpRating(m, gk.id, 0.2);
  } else {
    bumpRating(m, shooterId, -0.1);
  }
}

function simulateMinute(m, rng) {
  const strength = { home: effectiveStrength(m, 'home'), away: effectiveStrength(m, 'away') };
  for (const side of SIDES) {
    const edge = strength[side].attack / strength[other(side)].defense;
    if (rng.next() >= CHANCE_PER_MINUTE * edge ** CHANCE_EXPONENT) continue;
    const roll = rng.next();
    const [, kind, baseConversion] = CHANCE_KINDS.find(([limit]) => roll < limit);
    if (kind === 'corner' || kind === 'freekick') m.events.push({ minute: m.minute, type: kind, side });
    const shooter = pickShooter(rng, m[side], kind);
    const conversion = Math.min(0.9, kind === 'penalty' ? baseConversion : baseConversion * edge);
    const chance = { side, kind, playerId: shooter.id, conversion };
    // A chance do time do jogador vira lance jogável; o relógio espera a resposta.
    // Chance do jogador (ataque) — ou do adversário, com defesa ligada — vira lance jogável.
    if (m.interactive && !m.pending && (side === m.userSide || m.defend)) m.pending = chance;
    else applyChance(m, chance, rollOutcome(rng, conversion));
  }
  if (m.pending) {
    const { side, kind, playerId } = m.pending;
    m.events.push({ minute: m.minute, type: 'highlight', side, kind, playerId });
  }
}

function rollOutcome(rng, conversion) {
  if (rng.next() < conversion) return 'goal';
  return rng.next() < 0.5 ? 'saved' : 'wide';
}

function applyChance(m, { side, kind, playerId }, outcome) {
  m.events.push({ minute: m.minute, type: 'chance', kind, side, playerId, outcome });
  rateChance(m, side, playerId, outcome);
  if (outcome === 'goal') {
    m.score[side] += 1;
    m.events.push({ minute: m.minute, type: 'goal', kind, side, playerId });
  }
}

function closeMinute(m) {
  if (m.minute < HALF_END[m.phase]) return;
  const ended = m.phase === 'second';
  m.phase = ended ? 'ended' : 'halftime';
  m.events.push({ minute: m.minute, type: ended ? 'fulltime' : 'halftime' });
}

const everyone = (home, away) => [...home.lineup, ...away.lineup];

export function createMatch({ home, away, seed, userSide = null, interactive = false, defend = false }) {
  const ids = everyone(home, away).map((p) => p.id);
  return {
    home, away, userSide, interactive, defend,
    pending: null,
    highlightStart: null,
    rewindsLeft: 1,
    rng: seed >>> 0,
    phase: 'first',
    minute: 0,
    score: { home: 0, away: 0 },
    tactics: { home: { workRate: 5, focus: 'balanced' }, away: { workRate: 5, focus: 'balanced' } },
    ratings: Object.fromEntries(ids.map((id) => [id, 6.5])),
    discRng: (seed ^ 0x5bd1e995) >>> 0,
    cards: {},
    sentOff: [],
    morale: Object.fromEntries(everyone(home, away).map((p) => [p.id, p.morale ?? 70])),
    talked: { home: false, away: false },
    subbedOff: [],
    subbedOn: [],
    subs: { home: { count: 0, stops: [] }, away: { count: 0, stops: [] } },
    injuries: {},
    startingSize: { home: home.lineup.length, away: away.lineup.length },
    energy: Object.fromEntries(ids.map((id) => [id, 100])),
    events: [{ minute: 0, type: 'kickoff' }],
  };
}

export function setTactics(m, side, { workRate, focus } = {}) {
  const t = m.tactics[side];
  if (workRate !== undefined) t.workRate = Math.min(10, Math.max(1, Math.round(workRate)));
  if (focus !== undefined && FOCUS[focus]) t.focus = focus;
}

export function advanceMinute(m) {
  if (m.pending || (m.phase !== 'first' && m.phase !== 'second')) return;
  m.minute += 1;
  const rng = createRng(m.rng);
  simulateMinute(m, rng);
  m.rng = rng.state();
  simulateDiscipline(m);
  for (const side of SIDES) if (side !== m.userSide) aiSubstitutions(m, side);
  drainEnergy(m);
  if (!m.pending) closeMinute(m);
}

// Desfecho do lance jogável (vem do motor do lance ou de simulateHighlight).
export function resolveHighlight(m, { outcome }) {
  if (!m.pending) return;
  const chance = m.pending;
  m.pending = null;
  applyChance(m, chance, outcome);
  closeMinute(m);
}

// "Simular" o lance: mesma probabilidade da simulação automática.
export function simulateHighlight(m) {
  if (!m.pending) return;
  const rng = createRng(m.rng);
  const outcome = rollOutcome(rng, m.pending.conversion);
  m.rng = rng.state();
  resolveHighlight(m, { outcome });
}

export function startSecondHalf(m) {
  if (m.phase !== 'halftime') return;
  m.phase = 'second';
  m.events.push({ minute: m.minute, type: 'kickoff' });
}
