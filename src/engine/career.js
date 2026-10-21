// Carreira: o clube do usuário nas Séries A/B. Estado JSON puro (salvar no
// navegador). A cada rodada o jogo do usuário vem da tela; os outros são simulados.
import { buildTeam } from '../data/real-teams.js';
import { createSchedule, createTable, recordResult, playRound, promoteRelegate } from './league.js';

const DIVISIONS = ['A', 'B'];

function startSeason(c) {
  c.round = 0;
  c.schedules = {}; c.tables = {};
  for (const d of DIVISIONS) {
    c.schedules[d] = createSchedule(c.divisions[d], (c.seed * 7 + c.season * 13 + d.charCodeAt(0)) >>> 0);
    c.tables[d] = createTable(c.divisions[d]);
  }
  c.results = [];
}

export function newCareer({ clubs, squads, clubId, seed, asOf, season }) {
  const c = {
    version: 1, season, seed: seed >>> 0, clubId,
    divisions: { A: clubs.filter((x) => x.division === 'A').map((x) => x.id), B: clubs.filter((x) => x.division === 'B').map((x) => x.id) },
    teams: Object.fromEntries(clubs.filter((x) => squads[x.id]).map((x) => [x.id, buildTeam(x, squads[x.id], { asOf })])),
    fans: 60, board: 60,
  };
  startSeason(c);
  return c;
}

export const userDivision = (c) => (c.divisions.A.includes(c.clubId) ? 'A' : 'B');
export const seasonOver = (c) => c.round >= c.schedules[userDivision(c)].length;

export function nextFixture(c) {
  if (seasonOver(c)) return null;
  const g = c.schedules[userDivision(c)][c.round].find((x) => x.home === c.clubId || x.away === c.clubId);
  return { ...g, round: c.round + 1 };
}

// Fecha a rodada com o placar do jogo do usuário e simula o resto das duas séries.
export function completeRound(c, score) {
  const mine = userDivision(c);
  const seed = (c.seed + c.season * 1000 + c.round) >>> 0;
  for (const d of DIVISIONS) {
    const { results, userGame } = playRound({
      round: c.schedules[d][c.round], teams: c.teams, table: c.tables[d], seed: seed + d.charCodeAt(0), userTeam: d === mine ? c.clubId : null,
    });
    if (userGame) {
      recordResult(c.tables[d], userGame.home, userGame.away, score.home, score.away);
      c.results.push({ ...userGame, round: c.round + 1, score: { ...score } });
    }
    c.lastRound = { ...(c.lastRound ?? {}), [d]: results };
  }
  c.round += 1;
}

export function endSeason(c) {
  const { serieA, serieB } = promoteRelegate(c.tables.A, c.tables.B, 4);
  c.history = [...(c.history ?? []), { season: c.season, division: userDivision(c), tables: c.tables }];
  c.divisions = { A: serieA, B: serieB };
  c.season += 1;
  startSeason(c);
}
