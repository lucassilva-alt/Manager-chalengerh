// Times sintéticos para testes do motor (não são dados do jogo).
const POSITIONS_442 = ['GOL', 'LAT', 'ZAG', 'ZAG', 'LAT', 'MEI', 'VOL', 'VOL', 'MEI', 'ATA', 'ATA'];

export function makeTeam(name, level, { gk = level, bench = 0 } = {}) {
  const players = POSITIONS_442.map((pos, i) => ({
    id: `${name}-${i + 1}`,
    name: `${name} ${i + 1}`,
    pos,
    attrs: {
      pace: level, shooting: level, passing: level, dribbling: level,
      defending: level, physical: level, goalkeeping: pos === 'GOL' ? gk : 20,
    },
  }));
  // Reserva: um de cada posição, em ciclo (GOL, ZAG, LAT, VOL, MEI, ATA, ...).
  const BENCH_POS = ['GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'ATA'];
  const reserves = Array.from({ length: bench }, (_, i) => {
    const pos = BENCH_POS[i % BENCH_POS.length];
    return {
      id: `${name}-${12 + i}`, name: `${name} ${12 + i}`, pos,
      attrs: { pace: level, shooting: level, passing: level, dribbling: level, defending: level, physical: level, goalkeeping: pos === 'GOL' ? gk : 20 },
    };
  });
  return { id: name, name, formation: '4-4-2', lineup: players, bench: reserves };
}
