// Qualidade automática: mede o tempo dos quadros e baixa (ou sobe) o nível
// gráfico para manter o lance fluido no aparelho do jogador.
export const QUALITY = { LOW: 0, MEDIUM: 1, HIGH: 2 };

const WINDOW = 30;          // quadros na média
const SLOW_MS = 40;         // abaixo de ~25 fps: baixa
const FAST_MS = 20;         // acima de ~50 fps por bastante tempo: sobe
const UPGRADE_AFTER = 300;  // quadros rápidos seguidos para subir

export function createQualityGovernor({ fixed = null, onChange } = {}) {
  let level = fixed ?? QUALITY.HIGH;
  let samples = [], fastStreak = 0;

  function set(next) {
    if (next === level) return;
    level = next;
    samples = [];
    fastStreak = 0;
    onChange?.(level);
  }

  return {
    get level() { return level; },
    frame(ms) {
      if (fixed !== null) return;
      samples.push(ms);
      if (samples.length > WINDOW) samples.shift();
      fastStreak = ms < FAST_MS ? fastStreak + 1 : 0;
      if (samples.length === WINDOW) {
        const sorted = [...samples].sort((a, b) => a - b);
        const median = sorted[WINDOW >> 1];
        if (median > SLOW_MS && level > QUALITY.LOW) return set(level - 1);
      }
      if (fastStreak >= UPGRADE_AFTER && level < QUALITY.HIGH) set(level + 1);
    },
  };
}
