// Força de ataque e defesa de uma escalação, na escala dos atributos (1–99).
// O goleiro só pesa na defesa; cada posição pesa diferente em cada lado.
const ROLE = {
  ATA: { attack: 1.0, defense: 0.2 },
  MEI: { attack: 0.8, defense: 0.5 },
  VOL: { attack: 0.5, defense: 0.9 },
  LAT: { attack: 0.4, defense: 0.9 },
  ZAG: { attack: 0.15, defense: 1.0 },
};
const GK_SHARE = 0.2;

const attackScore = (a) => 0.3 * a.shooting + 0.3 * a.passing + 0.25 * a.dribbling + 0.15 * a.pace;
const defenseScore = (a) => 0.6 * a.defending + 0.4 * a.physical;
// Energia 100 = rendimento cheio; 0 = 60% do rendimento.
const energyFactor = (e = 100) => 0.6 + 0.4 * (e / 100);

function weightedAverage(players, side, score, energy) {
  let sum = 0, weight = 0;
  for (const p of players) {
    const w = ROLE[p.pos][side];
    sum += w * score(p.attrs) * energyFactor(energy[p.id]);
    weight += w;
  }
  return sum / weight;
}

export function teamStrength(team, { energy = {} } = {}) {
  const outfield = team.lineup.filter((p) => p.pos !== 'GOL');
  const gk = team.lineup.find((p) => p.pos === 'GOL');
  const gkScore = gk ? gk.attrs.goalkeeping * energyFactor(energy[gk.id]) : 0;
  return {
    attack: weightedAverage(outfield, 'attack', attackScore, energy),
    defense: (1 - GK_SHARE) * weightedAverage(outfield, 'defense', defenseScore, energy) + GK_SHARE * gkScore,
  };
}
