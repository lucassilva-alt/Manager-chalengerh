// E3: elencos reais — um por clube cadastrado, com fonte, posições que o jogo
// entende e o mínimo para escalar (goleiro + 10 de linha).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mapPosition } from '../../src/engine/player.js';

const { clubs } = JSON.parse(await readFile('data/clubs-2026.json', 'utf8'));
const data = JSON.parse(await readFile('data/squads-2026.json', 'utf8'));

test('um elenco por clube, cada um com fonte https', () => {
  assert.deepEqual(Object.keys(data.squads).sort(), clubs.map((c) => c.id).sort());
  for (const [id, s] of Object.entries(data.squads)) assert.match(s.source, /^https:\/\//, id);
});

test('todo jogador tem nome e posição reconhecida; dá para escalar', () => {
  for (const [id, s] of Object.entries(data.squads)) {
    assert.ok(s.players.length >= 18, `${id}: ${s.players.length} jogadores`);
    for (const p of s.players) {
      assert.ok(p.name && p.name.trim(), `${id}: jogador sem nome`);
      assert.ok(mapPosition(p.pos), `${id}: posição "${p.pos}" de ${p.name}`);
    }
    const pos = s.players.map((p) => mapPosition(p.pos));
    assert.ok(pos.filter((x) => x === 'GOL').length >= 1, `${id}: sem goleiro`);
    assert.ok(pos.filter((x) => x !== 'GOL').length >= 10, `${id}: menos de 10 de linha`);
  }
});
