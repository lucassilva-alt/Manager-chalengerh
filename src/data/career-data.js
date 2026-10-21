// Dados reais da temporada: clubes (data/clubs-2026.json) e elencos
// (data/squads-2026.json), cada um com a sua fonte.
export async function loadCareerData(base = '.') {
  const [clubs, squads] = await Promise.all([
    fetch(`${base}/data/clubs-2026.json`).then((r) => r.json()),
    fetch(`${base}/data/squads-2026.json`).then((r) => r.json()),
  ]);
  return { clubs: clubs.clubs, squads: squads.squads, asOf: squads.asOf, season: 2026 };
}
