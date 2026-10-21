// Salvar a carreira no navegador. Armazenamento pode estar bloqueado (aba
// anônima, permissão): nunca quebra o jogo, só deixa de salvar.
const KEY = 'mc.career.v1';

export function saveCareer(career) {
  try { localStorage.setItem(KEY, JSON.stringify(career)); return true; } catch { return false; }
}

export function loadCareer() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
