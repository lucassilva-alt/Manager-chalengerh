// Retrato do jogador desenhado por código (SVG): rosto, pele, cabelo, barba e
// camisa do time. Mesmo id = mesmo rosto (ver src/data/looks.js).
import { looksFor } from '../data/looks.js';

const KEEPER_SHIRT = '#f2c230';

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}

const HAIR = {
  short: (c) => `<path d="M27 40 Q26 18 50 16 Q74 18 73 40 Q70 30 62 28 Q50 24 38 28 Q30 31 27 40Z" fill="${c}"/>`,
  buzz: (c) => `<path d="M29 37 Q29 20 50 19 Q71 20 71 37 Q66 28 50 27 Q34 28 29 37Z" fill="${c}" opacity="0.75"/>`,
  curly: (c) => `<g fill="${c}">${[[30, 30], [38, 21], [50, 18], [62, 21], [70, 30], [34, 25], [66, 25], [44, 19], [56, 19]]
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8"/>`).join('')}</g>`,
  long: (c) => `<path d="M25 58 Q22 18 50 15 Q78 18 75 58 L70 58 Q70 32 50 28 Q30 32 30 58Z" fill="${c}"/>`,
  bald: () => '',
  mohawk: (c) => `<path d="M43 30 Q44 10 50 9 Q56 10 57 30 Q50 27 43 30Z" fill="${c}"/><path d="M29 37 Q30 24 43 27 L43 31 Q34 31 29 37Z M71 37 Q70 24 57 27 L57 31 Q66 31 71 37Z" fill="${c}" opacity="0.4"/>`,
};

export function portraitSvg(id, kit, { keeper = false } = {}) {
  const { skin, hair, hairStyle, beard, brow } = looksFor(id);
  const shirt = keeper ? KEEPER_SHIRT : kit.shirt;
  const collar = keeper ? '#1b1b1f' : kit.shorts;
  const dark = shade(skin, 0.8);
  const browW = 1.6 + brow * 0.6;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true">`
    + `<path d="M10 100 Q12 76 34 72 L66 72 Q88 76 90 100Z" fill="${shirt}"/>`
    + `<path d="M38 72 L50 84 L62 72" fill="none" stroke="${collar}" stroke-width="5" stroke-linejoin="round"/>`
    + `<rect x="42" y="56" width="16" height="18" rx="4" fill="${dark}"/>`
    + `<ellipse cx="28" cy="46" rx="4" ry="6" fill="${dark}"/><ellipse cx="72" cy="46" rx="4" ry="6" fill="${dark}"/>`
    + `<path d="M28 40 Q28 20 50 20 Q72 20 72 40 Q72 62 50 68 Q28 62 28 40Z" fill="${skin}"/>`
    + `<path d="M50 20 Q72 20 72 40 Q72 62 50 68 Q64 56 64 40 Q64 24 50 20Z" fill="${dark}" opacity="0.35"/>`
    + (beard ? `<path d="M30 48 Q32 66 50 69 Q68 66 70 48 Q66 58 50 60 Q34 58 30 48Z" fill="${hair}" opacity="0.85"/>` : '')
    + `<path d="M36 ${38 - brow * 0.4} Q41 35 46 37" stroke="${hair}" stroke-width="${browW}" fill="none" stroke-linecap="round"/>`
    + `<path d="M54 37 Q59 35 64 ${38 - brow * 0.4}" stroke="${hair}" stroke-width="${browW}" fill="none" stroke-linecap="round"/>`
    + `<ellipse cx="41" cy="43" rx="3.4" ry="2.4" fill="#fff"/><ellipse cx="59" cy="43" rx="3.4" ry="2.4" fill="#fff"/>`
    + `<circle cx="41.5" cy="43.2" r="1.6" fill="#2a1d14"/><circle cx="59.5" cy="43.2" r="1.6" fill="#2a1d14"/>`
    + `<path d="M50 45 Q47 52 49 54 L52 54" stroke="${shade(skin, 0.65)}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`
    + `<path d="M44 59 Q50 62 56 59" stroke="${shade(skin, 0.5)}" stroke-width="2" fill="none" stroke-linecap="round"/>`
    + HAIR[hairStyle](hair)
    + `</svg>`;
}
