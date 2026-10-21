// Clube real (data/clubs-2026.json) + elenco da fonte (data/squads/<id>.json)
// → time do jogo. Nomes, posições, números e idades vêm da fonte; atributos
// são estimativa do jogo (ver src/engine/player.js).
import { createSquadPlayer } from '../engine/player.js';
import { pickLineup } from '../engine/formations.js';

// Nível médio estimado por divisão (o jogador varia em torno disso).
const DIVISION_LEVEL = { A: 70, B: 64 };
const BENCH_SIZE = 12;

export function ageOn(birthDate, asOf) {
  if (!birthDate) return null;
  const [by, bm, bd] = birthDate.split('-').map(Number);
  const [y, m, d] = asOf.split('-').map(Number);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

export function buildTeam(club, squad, { asOf, formation = '4-4-2' }) {
  const level = DIVISION_LEVEL[club.division] ?? DIVISION_LEVEL.B;
  const seen = new Set();
  const players = squad.players.map((p, i) => {
    const player = createSquadPlayer({ ...p, age: ageOn(p.birthDate, asOf) }, { clubId: club.id, level });
    if (seen.has(player.id)) player.id = `${player.id}-${i}`;
    seen.add(player.id);
    return player;
  }).filter((p) => p.pos);
  const lineup = pickLineup(players, formation);
  const inXI = new Set(lineup.map((p) => p.id));
  const bench = pickLineup(players.filter((p) => !inXI.has(p.id)), formation).slice(0, BENCH_SIZE)
    .map(({ natural, fit, slot, ...p }) => ({ ...p, pos: natural }));
  return {
    id: club.id, name: club.name, short: club.short, crest: club.crest, formation,
    colors: { shirt: club.colors.shirt, shorts: club.colors.shorts, socks: club.colors.shirt },
    stadium: { name: club.stadium, capacity: club.capacity, city: club.city },
    squad: players, lineup, bench, source: squad.source,
  };
}
