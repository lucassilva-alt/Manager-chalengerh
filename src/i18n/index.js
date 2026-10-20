// i18n mínimo: t('chave', { nome: 'valor' }) com troca de {nome}.
import ptBR from './pt-BR.js';

const dictionaries = { 'pt-BR': ptBR };
let current = dictionaries['pt-BR'];

export function setLocale(locale) {
  current = dictionaries[locale] ?? dictionaries['pt-BR'];
}

export function t(key, vars = {}) {
  const text = current[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}
