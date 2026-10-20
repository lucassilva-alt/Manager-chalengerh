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

function simulateMinute(m, rng) {
  const strength = { home: teamStrength(m.home), away: teamStrength(m.away) };
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
    if (scored) {
      m.score[side] += 1;
      m.events.push({ minute: m.minute, type: 'goal', kind, side, playerId: shooter.id });
    }
  }
}

export function createMatch({ home, away, seed, userSide = null }) {
  return {
    home, away, userSide,
    rng: seed >>> 0,
    phase: 'first',
    minute: 0,
    score: { home: 0, away: 0 },
    events: [{ minute: 0, type: 'kickoff' }],
  };
}

export function advanceMinute(m) {
  if (m.phase !== 'first' && m.phase !== 'second') return;
  m.minute += 1;
  const rng = createRng(m.rng);
  simulateMinute(m, rng);
  m.rng = rng.state();
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
