// V1: o boneco do jogador é um glTF leve, com esqueleto e só as animações usadas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const FILE = new URL('../../assets/models/player.glb', import.meta.url);
import { PLAYER_CLIPS } from '../../src/render/player-clips.js';

function readGlbJson(buf) {
  assert.equal(buf.toString('ascii', 0, 4), 'glTF');
  const len = buf.readUInt32LE(12);
  return JSON.parse(buf.toString('utf8', 20, 20 + len));
}

test('arquivo existe e cabe no orçamento (≤ 2,5 MB)', () => {
  const size = fs.statSync(FILE).size;
  assert.ok(size <= 2.5 * 1024 * 1024, `tamanho ${size}`);
});

test('tem malha com esqueleto', () => {
  const j = readGlbJson(fs.readFileSync(FILE));
  assert.equal(j.meshes.length >= 1, true);
  assert.equal(j.skins.length, 1);
  assert.ok(j.skins[0].joints.length >= 40);
});

test('tem exatamente as animações usadas pelo jogo', () => {
  const j = readGlbJson(fs.readFileSync(FILE));
  assert.deepEqual(j.animations.map((a) => a.name).sort(), [...PLAYER_CLIPS].sort());
});

test('créditos e licença CC0 acompanham o modelo', () => {
  const credits = fs.readFileSync(new URL('../../assets/models/CREDITS.md', import.meta.url), 'utf8');
  assert.match(credits, /Quaternius/);
  assert.match(credits, /CC0/);
});
