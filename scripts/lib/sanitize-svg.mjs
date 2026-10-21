// Limpeza de SVG de terceiros antes de entrar no jogo: só o desenho fica.
// Tira script, foreignObject, DOCTYPE (entidades), eventos on*, links externos
// e CSS que busca coisa fora. Referências internas (#id) e imagens data: ficam.
const BLOCKS = ['script', 'foreignObject', 'iframe', 'embed', 'object'];
const SAFE_REF = /^\s*(#|data:image\/)/i;

export function sanitizeSvg(text) {
  let s = text.replace(/<!DOCTYPE[^>[]*(\[[\s\S]*?\])?\s*>/gi, '');
  for (const tag of BLOCKS) {
    s = s.replace(new RegExp(`<${tag}\\b[\\s\\S]*?</${tag}\\s*>`, 'gi'), '');
    s = s.replace(new RegExp(`<${tag}\\b[^>]*/>`, 'gi'), '');
  }
  // Atributos de evento: onload, onclick, ...
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // href / xlink:href só para dentro do próprio arquivo ou imagem embutida.
  s = s.replace(/\s+(xlink:)?href\s*=\s*("([^"]*)"|'([^']*)')/gi, (m, _ns, _q, dq, sq) => (SAFE_REF.test(dq ?? sq) ? m : ''));
  // CSS: nada de @import nem url() para fora.
  s = s.replace(/@import[^;]*;?/gi, '');
  s = s.replace(/url\(\s*(['"]?)(?!#|data:image\/)[^)]*\)/gi, 'none');
  return s.trim();
}

// "Atlético_Mineiro.svg" → "atletico-mineiro"
export function slugify(fileName) {
  return fileName
    .replace(/\.svg$/i, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
