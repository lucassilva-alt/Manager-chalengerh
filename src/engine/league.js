// Liga de pontos corridos (Brasileirão): turno e returno, classificação pelos
// critérios da CBF (pontos, vitórias, saldo, gols pró), rodada simulada.
import { createRng } from './rng.js';
import { createMatch, advanceMinute, startSecondHalf } from './match-sim.js';

// Método do círculo: um time fixo, os outros giram; returno espelha com mando trocado.
export function createSchedule(ids, seed) {
  const rng = createRng(seed);
  const list = [...ids];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  if (list.length % 2) list.push(null); // folga
  const n = list.length, first = [];
  let arr = list;
  for (let r = 0; r < n - 1; r++) {
    const round = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      if (a === null || b === null) continue;
      const aHome = r % 2 === 0; // alterna o mando a cada rodada
      round.push(aHome ? { home: a, away: b } : { home: b, away: a });
    }
    first.push(round);
    arr = [arr[0], arr[n - 1], ...arr.slice(1, n - 1)];
  }
  return [...first, ...first.map((round) => round.map((g) => ({ home: g.away, away: g.home })))];
}

export function createTable(ids) {
  return Object.fromEntries(ids.map((id) => [id, { id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }]));
}

export function recordResult(table, home, away, hg, ag) {
  const h = table[home], a = table[away];
  h.played++; a.played++;
  h.gf += hg; h.ga += ag; a.gf += ag; a.ga += hg;
  if (hg > ag) { h.won++; a.lost++; h.points += 3; }
  else if (hg < ag) { a.won++; h.lost++; a.points += 3; }
  else { h.drawn++; a.drawn++; h.points++; a.points++; }
}

export function standings(table) {
  return Object.values(table).sort((x, y) =>
    y.points - x.points || y.won - x.won || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.id.localeCompare(y.id));
}

// Partida rápida (sem lance jogável) até o apito final.
export function quickMatch(home, away, seed) {
  const m = createMatch({ home, away, seed });
  while (m.phase !== 'ended') {
    if (m.phase === 'halftime') startSecondHalf(m);
    else advanceMinute(m);
  }
  return m;
}

// Joga a rodada inteira menos o jogo do time do jogador, que volta para ser jogado.
export function playRound({ round, teams, table, seed, userTeam = null }) {
  const results = [];
  let userGame = null;
  round.forEach((g, i) => {
    if (g.home === userTeam || g.away === userTeam) { userGame = g; return; }
    const m = quickMatch(teams[g.home], teams[g.away], (seed * 31 + i * 7919) >>> 0);
    recordResult(table, g.home, g.away, m.score.home, m.score.away);
    results.push({ ...g, score: { ...m.score } });
  });
  return { results, userGame };
}

// Fim de temporada: os `n` últimos da A descem e os `n` primeiros da B sobem.
export function promoteRelegate(tableA, tableB, n = 4) {
  const a = standings(tableA).map((r) => r.id), b = standings(tableB).map((r) => r.id);
  return {
    serieA: [...a.slice(0, a.length - n), ...b.slice(0, n)],
    serieB: [...a.slice(a.length - n), ...b.slice(n)],
  };
}
