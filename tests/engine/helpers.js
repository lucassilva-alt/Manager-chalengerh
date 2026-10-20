// Times sintéticos para testes do motor (não são dados do jogo).
const POSITIONS_442 = ['GOL', 'LAT', 'ZAG', 'ZAG', 'LAT', 'MEI', 'VOL', 'VOL', 'MEI', 'ATA', 'ATA'];

export function makeTeam(name, level, { gk = level } = {}) {
  const players = POSITIONS_442.map((pos, i) => ({
    id: `${name}-${i + 1}`,
    name: `${name} ${i + 1}`,
    pos,
    attrs: {
      pace: level, shooting: level, passing: level, dribbling: level,
      defending: level, physical: level, goalkeeping: pos === 'GOL' ? gk : 20,
    },
  }));
  return { id: name, name, formation: '4-4-2', lineup: players };
}
