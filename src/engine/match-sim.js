// Simulação da partida minuto a minuto. O estado é JSON puro (salvar,
// restaurar, voltar o lance); o sorteio vive em `rng` como número.
import { createRng } from './rng.js';
import { teamStrength } from './teams.js';

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

function effectiveStrength(m, side) {
  const { workRate, focus } = m.tactics[side];
  const base = teamStrength(m[side], { energy: m.energy });
  return {
    attack: base.attack * workRateFactor(workRate) * FOCUS[focus].attack,
    defense: base.defense * workRateFactor(workRate) * FOCUS[focus].defense,
  };
}

function drainEnergy(m) {
  for (const side of SIDES) {
    const effort = 0.5 + m.tactics[side].workRate / 10;
    for (const p of m[side].lineup) {
      const loss = ENERGY_DRAIN * effort * (1 - p.attrs.physical / 200);
      m.energy[p.id] = Math.max(0, m.energy[p.id] - loss);
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
    const scored = rng.next() < conversion;
    const outcome = scored ? 'goal' : rng.next() < 0.5 ? 'saved' : 'wide';
    m.events.push({ minute: m.minute, type: 'chance', kind, side, playerId: shooter.id, outcome });
    rateChance(m, side, shooter.id, outcome);
    if (scored) {
      m.score[side] += 1;
      m.events.push({ minute: m.minute, type: 'goal', kind, side, playerId: shooter.id });
    }
  }
}

const everyone = (home, away) => [...home.lineup, ...away.lineup];

export function createMatch({ home, away, seed, userSide = null }) {
  const ids = everyone(home, away).map((p) => p.id);
  return {
    home, away, userSide,
    rng: seed >>> 0,
    phase: 'first',
    minute: 0,
    score: { home: 0, away: 0 },
    tactics: { home: { workRate: 5, focus: 'balanced' }, away: { workRate: 5, focus: 'balanced' } },
    ratings: Object.fromEntries(ids.map((id) => [id, 6.5])),
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
  if (m.phase !== 'first' && m.phase !== 'second') return;
  m.minute += 1;
  const rng = createRng(m.rng);
  simulateMinute(m, rng);
  m.rng = rng.state();
  drainEnergy(m);
  if (m.minute >= HALF_END[m.phase]) {
    const ended = m.phase === 'second';
    m.phase = ended ? 'ended' : 'halftime';
    m.events.push({ minute: m.minute, type: ended ? 'fulltime' : 'halftime' });
  }
}

export function startSecondHalf(m) {
  if (m.phase !== 'halftime') return;
  m.phase = 'second';
  m.events.push({ minute: m.minute, type: 'kickoff' });
}
