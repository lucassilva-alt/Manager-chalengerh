// Aparência estável por jogador (mesmo id = mesmo rosto, pele e cabelo),
// usada pelo boneco 3D e pelo retrato da interface.
export const SKINS = ['#f3cfb3', '#e0ac85', '#c68a5e', '#9a643e', '#6e4529', '#4c2f1d'];
export const HAIRS = ['#1d1612', '#3b2618', '#6b4423', '#a8743f', '#d9b36b', '#2a2a2a'];
export const HAIR_STYLES = ['short', 'buzz', 'curly', 'long', 'bald', 'mohawk'];

function hashOf(id) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

export function looksFor(id) {
  const h = hashOf(id);
  return {
    skin: SKINS[h % SKINS.length],
    hair: HAIRS[(h >>> 8) % HAIRS.length],
    hairStyle: HAIR_STYLES[(h >>> 12) % HAIR_STYLES.length],
    beard: ((h >>> 16) & 7) < 3,
    brow: ((h >>> 20) & 3),
  };
}
