// Monta os times provisórios de data/demo-teams.json com escalação 4-4-2.
const POSITIONS_442 = ['GOL', 'LAT', 'ZAG', 'ZAG', 'LAT', 'MEI', 'VOL', 'VOL', 'MEI', 'ATA', 'ATA'];

function demoPlayer(team, pos, i) {
  const l = team.level;
  return {
    id: `${team.id}-${i + 1}`,
    name: `${team.short} ${i + 1}`,
    number: i + 1,
    pos,
    attrs: {
      pace: l, shooting: pos === 'ATA' ? l + 6 : l - 4, passing: l, dribbling: l,
      defending: pos === 'ZAG' || pos === 'VOL' ? l + 6 : l - 6, physical: l,
      goalkeeping: pos === 'GOL' ? l + 4 : 20,
    },
  };
}

export async function loadDemoTeams(base = '.') {
  const res = await fetch(`${base}/data/demo-teams.json`);
  const { teams } = await res.json();
  return teams.map((t) => ({ ...t, lineup: POSITIONS_442.map((pos, i) => demoPlayer(t, pos, i)) }));
}
