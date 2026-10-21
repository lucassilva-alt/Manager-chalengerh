// Jogador do elenco. Nome, idade, posição e número vêm do cadastro real; os
// atributos são estimativa do jogo: qualidade (do cadastro ou nível do clube)
// + perfil da posição + curva de idade + variação fixa por jogador.
import { createRng } from './rng.js';

const ATTRS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'goalkeeping'];

// Peso de cada atributo na nota geral, por posição (soma 1).
const WEIGHTS = {
  GOL: { goalkeeping: 0.85, physical: 0.15 },
  ZAG: { defending: 0.45, physical: 0.3, pace: 0.1, passing: 0.15 },
  LAT: { pace: 0.25, defending: 0.3, passing: 0.25, physical: 0.1, dribbling: 0.1 },
  VOL: { defending: 0.35, passing: 0.35, physical: 0.2, pace: 0.1 },
  MEI: { passing: 0.35, dribbling: 0.3, shooting: 0.2, pace: 0.15 },
  ATA: { shooting: 0.4, dribbling: 0.25, pace: 0.25, physical: 0.1 },
};
// Diferença de cada atributo para a qualidade, por posição.
const PROFILE = {
  GOL: { goalkeeping: 0, physical: -5, pace: -35, shooting: -40, passing: -30, dribbling: -40, defending: -35 },
  ZAG: { defending: 4, physical: 1, pace: -6, passing: -8, shooting: -20, dribbling: -15, goalkeeping: -50 },
  LAT: { pace: 4, defending: 0, passing: 0, physical: -2, dribbling: -2, shooting: -14, goalkeeping: -50 },
  VOL: { defending: 2, passing: 2, physical: 0, pace: -6, shooting: -8, dribbling: -6, goalkeeping: -50 },
  MEI: { passing: 3, dribbling: 2, shooting: -2, pace: -4, defending: -14, physical: -8, goalkeeping: -50 },
  ATA: { shooting: 3, dribbling: 0, pace: 0, physical: -4, passing: -6, defending: -22, goalkeeping: -50 },
};
const NOISE = 4;            // ± por atributo
const PEAK = { from: 24, to: 30 };
const YOUTH_LOSS = 1.6;     // pontos por ano abaixo do auge
const AGE_LOSS = 1.5;       // pontos por ano acima do auge
const CLUB_SPREAD = 6;
const DEFAULT_AGE = 26;      // ± em torno do nível do clube quando o cadastro não traz qualidade

// Personalidade: pesa na conversa do intervalo, na moral e nas reclamações.
export const TRAITS = ['Líder', 'Profissional', 'Temperamental', 'Tranquilo', 'Preguiçoso', 'Ambicioso', 'Leal', 'Vaidoso'];

const clamp = (v) => Math.max(1, Math.min(99, Math.round(v)));

// Semente de texto → número (FNV-1a), para a variação ficar presa ao jogador.
function hash(seed) {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 0x811c9dc5;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.codePointAt(0), 0x01000193);
  return h >>> 0;
}

function ageDelta(age) {
  if (age < PEAK.from) return -(PEAK.from - age) * YOUTH_LOSS;
  if (age > PEAK.to) return -(age - PEAK.to) * AGE_LOSS;
  return 0;
}

export function overall({ pos, attrs }) {
  let sum = 0;
  for (const [k, w] of Object.entries(WEIGHTS[pos])) sum += w * attrs[k];
  return Math.round(sum);
}

export function ratePlayer({ pos, age, quality, seed }) {
  const rng = createRng(hash(seed));
  const delta = ageDelta(age);
  const attrs = {};
  for (const k of ATTRS) {
    const aged = k === 'goalkeeping' && pos !== 'GOL' ? 0 : delta;
    attrs[k] = clamp(quality + PROFILE[pos][k] + aged + rng.int(-NOISE, NOISE));
  }
  const now = overall({ pos, attrs });
  const growth = age < PEAK.from ? (PEAK.from - age) * YOUTH_LOSS + rng.int(0, 8) : age <= PEAK.to ? rng.int(0, 3) : 0;
  return { attrs, potential: clamp(now + growth) };
}

const POSITION_WORDS = [
  [/^(gk|gol|goleiro|goalkeeper)$/, 'GOL'],
  [/^(cb|df|zag|zagueiro|centre-back|center-back|defensor central|defensor)$/, 'ZAG'],
  [/^(lb|rb|lwb|rwb|lat|lateral.*|full-back|ala)$/, 'LAT'],
  [/^(dm|cdm|vol|volante|defensive midfielder)$/, 'VOL'],
  [/^(mf|cm|am|cam|mei|meia|meio-campista|meio-campo|midfielder|meia-atacante|attacking midfielder)$/, 'MEI'],
  [/^(fw|st|cf|lw|rw|ata|atacante|centroavante|ponta.*|forward|winger|striker)$/, 'ATA'],
];

// Fonte que só diz GK/DF/MF/FW: o jogador cobre as vagas daquela faixa sem punição.
const BROAD_ROLES = { df: ['ZAG', 'LAT'], mf: ['VOL', 'MEI'] };

export function mapPosition(raw) {
  const s = String(raw).trim().toLowerCase();
  return POSITION_WORDS.find(([re]) => re.test(s))?.[1] ?? null;
}

// Perfil real (nome, posição, idade, número, nacionalidade, qualidade opcional) → jogador do jogo.
export function createSquadPlayer(profile, { clubId, level }) {
  const pos = mapPosition(profile.pos) ?? profile.pos;
  const roles = BROAD_ROLES[String(profile.pos).trim().toLowerCase()] ?? [pos];
  const id = `${clubId}-${profile.number ?? profile.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const rng = createRng(hash(`${id}:club`));
  const quality = profile.quality ?? level + rng.int(-CLUB_SPREAD, CLUB_SPREAD);
  // Sem data de nascimento na fonte: nota calculada com idade de auge, idade fica em branco.
  const { attrs, potential } = ratePlayer({ pos, age: profile.age ?? DEFAULT_AGE, quality, seed: id });
  const traits = [];
  for (let n = rng.int(0, 2); traits.length < n;) {
    const t = TRAITS[rng.int(0, TRAITS.length - 1)];
    if (!traits.includes(t)) traits.push(t);
  }
  return {
    id, name: profile.name, number: profile.number ?? null, pos, roles, age: profile.age ?? null,
    nationality: profile.nationality ?? null,
    attrs, potential, traits,
    morale: 70, form: [], fitness: 100, injury: null,
  };
}
