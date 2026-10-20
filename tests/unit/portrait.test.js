import { test } from 'node:test';
import assert from 'node:assert/strict';
import { portraitSvg } from '../../src/ui/portrait.js';
import { looksFor } from '../../src/data/looks.js';

const kit = { shirt: '#d33a2d', shorts: '#1d2b6b' };

test('retrato é SVG válido com a pele e o cabelo do jogador', () => {
  const svg = portraitSvg('demo-azul-7', kit);
  assert.match(svg, /^<svg[^>]*viewBox="0 0 100 100"/);
  assert.match(svg, /<\/svg>$/);
  const { skin, hair, hairStyle } = looksFor('demo-azul-7');
  assert.ok(svg.includes(skin), 'pele');
  if (hairStyle !== 'bald') assert.ok(svg.includes(hair), 'cabelo');
});

test('mesmo jogador, mesmo retrato; jogadores diferentes variam', () => {
  assert.equal(portraitSvg('x-1', kit), portraitSvg('x-1', kit));
  const set = new Set(Array.from({ length: 30 }, (_, i) => portraitSvg(`time-${i}`, kit)));
  assert.ok(set.size >= 25, `variedade ${set.size}`);
});

test('camisa do retrato usa a cor do time; goleiro usa a dele', () => {
  assert.ok(portraitSvg('a', kit).includes(kit.shirt));
  assert.ok(portraitSvg('a', kit, { keeper: true }).includes('#f2c230'));
});

test('estilos de cabelo e barba aparecem na população', () => {
  const looks = Array.from({ length: 200 }, (_, i) => looksFor(`p-${i}`));
  assert.ok(new Set(looks.map((l) => l.hairStyle)).size >= 5);
  assert.ok(looks.some((l) => l.beard) && looks.some((l) => !l.beard));
});
