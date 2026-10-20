// Simulação da partida minuto a minuto. O estado é JSON puro (salvar,
// restaurar, voltar o lance); o sorteio vive em `rng` como número.
const HALF_END = { first: 45, second: 90 };

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
