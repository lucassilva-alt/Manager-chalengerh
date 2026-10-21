// Formações: vagas por posição com lugar no campo (x: largura 0–1, esquerda →
// direita; y: profundidade 0–1, do próprio gol ao ataque) e o peso tático.
import { overall } from './player.js';

const row = (pos, y, n, spread = 0.7) =>
  Array.from({ length: n }, (_, i) => ({ pos, y, x: n === 1 ? 0.5 : 0.5 - spread / 2 + (spread * i) / (n - 1) }));
const GK = { pos: 'GOL', x: 0.5, y: 0.04 };

export const FORMATIONS = {
  '4-4-2': { bias: { attack: 1, defense: 1 },
    slots: [GK, ...row('LAT', 0.24, 2, 0.84), ...row('ZAG', 0.2, 2, 0.32), ...row('MEI', 0.52, 2, 0.8), ...row('VOL', 0.45, 2, 0.3), ...row('ATA', 0.8, 2, 0.34)] },
  '4-3-3': { bias: { attack: 1.03, defense: 0.98 },
    slots: [GK, ...row('LAT', 0.24, 2, 0.84), ...row('ZAG', 0.2, 2, 0.32), { pos: 'VOL', x: 0.5, y: 0.42 }, ...row('MEI', 0.55, 2, 0.44), ...row('ATA', 0.8, 3, 0.7)] },
  '4-2-3-1': { bias: { attack: 1.01, defense: 1 },
    slots: [GK, ...row('LAT', 0.24, 2, 0.84), ...row('ZAG', 0.2, 2, 0.32), ...row('VOL', 0.42, 2, 0.3), ...row('MEI', 0.62, 3, 0.7), { pos: 'ATA', x: 0.5, y: 0.84 }] },
  '3-5-2': { bias: { attack: 1.02, defense: 0.98 },
    slots: [GK, ...row('ZAG', 0.2, 3, 0.5), ...row('LAT', 0.5, 2, 0.9), { pos: 'VOL', x: 0.5, y: 0.42 }, ...row('MEI', 0.55, 2, 0.4), ...row('ATA', 0.8, 2, 0.34)] },
  '5-3-2': { bias: { attack: 0.97, defense: 1.03 },
    slots: [GK, ...row('ZAG', 0.18, 3, 0.5), ...row('LAT', 0.3, 2, 0.88), { pos: 'VOL', x: 0.5, y: 0.42 }, ...row('MEI', 0.55, 2, 0.5), ...row('ATA', 0.8, 2, 0.34)] },
};

// Rendimento jogando numa posição que não é a sua (1 = posição natural).
const NEIGHBORS = {
  GOL: [],
  ZAG: ['LAT', 'VOL'],
  LAT: ['ZAG', 'VOL', 'MEI'],
  VOL: ['ZAG', 'MEI', 'LAT'],
  MEI: ['VOL', 'ATA', 'LAT'],
  ATA: ['MEI'],
};
export function positionFit(natural, slot) {
  if (natural === slot) return 1;
  if (natural === 'GOL' || slot === 'GOL') return 0.3;
  return NEIGHBORS[natural].includes(slot) ? 0.88 : 0.72;
}

// Melhor XI para a formação: primeiro cada vaga com quem é da posição (maior nota
// primeiro); vagas que sobram, com o melhor improvisado.
export function pickLineup(squad, formation) {
  const slots = FORMATIONS[formation].slots;
  const free = squad.filter((p) => !p.injury).map((p) => ({ p, rating: overall(p) })).sort((a, b) => b.rating - a.rating);
  const taken = new Array(slots.length).fill(null);
  const use = (i, entry) => { taken[i] = entry.p; free.splice(free.indexOf(entry), 1); };
  slots.forEach((s, i) => {
    const natural = free.find((e) => e.p.pos === s.pos);
    if (natural) use(i, natural);
  });
  slots.forEach((s, i) => {
    if (taken[i] || !free.length) return;
    const best = free.reduce((a, b) => (b.rating * positionFit(b.p.pos, s.pos) > a.rating * positionFit(a.p.pos, s.pos) ? b : a));
    use(i, best);
  });
  return taken.filter(Boolean).map((p, i) => ({ ...p, natural: p.pos, pos: slots[i].pos, fit: positionFit(p.pos, slots[i].pos), slot: i }));
}
