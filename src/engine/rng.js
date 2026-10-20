// Sorteio com semente (mulberry32). Todo acaso do motor passa por aqui:
// mesma semente + mesmos comandos = mesma partida (testes, replay, voltar o lance).
export function createRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    state: () => s,
    restore: (saved) => { s = saved >>> 0; },
  };
}
