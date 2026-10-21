// E1: escudos externos entram limpos — sem script, eventos ou links para fora.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeSvg, slugify } from '../../scripts/lib/sanitize-svg.mjs';

const svg = (body) => `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`;

test('mantém o desenho', () => {
  const out = sanitizeSvg(svg('<path d="M0 0h10v10z" fill="#c00"/><g transform="scale(2)"><circle r="2"/></g>'));
  assert.match(out, /<path d="M0 0h10v10z" fill="#c00"\/>/);
  assert.match(out, /<circle r="2"\/>/);
});

test('remove script, foreignObject e atributos de evento', () => {
  const out = sanitizeSvg(svg('<script>alert(1)</script><foreignObject><div>x</div></foreignObject><path onload="alert(1)" ONCLICK=\'x()\' d="M0 0"/>'));
  assert.doesNotMatch(out, /script|foreignObject|onload|onclick/i);
  assert.match(out, /<path\s+d="M0 0"\/>/);
});

test('remove links externos e javascript:, mantém referências internas e imagens embutidas', () => {
  const out = sanitizeSvg(svg('<use href="#a"/><use xlink:href="http://evil/x.svg#a"/><a href="javascript:alert(1)"><path d="M1 1"/></a><image href="data:image/png;base64,AAAA"/><image href="https://x/y.png"/>'));
  assert.match(out, /href="#a"/);
  assert.match(out, /data:image\/png;base64,AAAA/);
  assert.doesNotMatch(out, /evil|javascript:|https:\/\/x/);
});

test('slug simples a partir do nome do arquivo', () => {
  assert.equal(slugify('Atlético_Mineiro.svg'), 'atletico-mineiro');
  assert.equal(slugify('America_Football_Club_(RJ).svg'), 'america-football-club-rj');
  assert.equal(slugify('São_Paulo.svg'), 'sao-paulo');
});
