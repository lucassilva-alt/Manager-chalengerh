// B2: formações — vagas por posição, melhor XI automático, jogador fora de
// posição rende menos e a formação pesa no ataque/defesa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FORMATIONS, pickLineup, positionFit } from '../../src/engine/formations.js';
import { teamStrength } from '../../src/engine/teams.js';
import { createSquadPlayer } from '../../src/engine/player.js';

const POS = ['GOL', 'GOL', 'ZAG', 'ZAG', 'ZAG', 'ZAG', 'LAT', 'LAT', 'LAT', 'VOL', 'VOL', 'VOL', 'MEI', 'MEI', 'MEI', 'MEI', 'ATA', 'ATA', 'ATA', 'ATA', 'ATA'];
const squad = POS.map((pos, i) => createSquadPlayer({ name: `J${i + 1}`, pos, age: 26, number: i + 1 }, { clubId: 'c', level: 68 }));

test('as 5 formações têm 11 vagas, 1 goleiro e coordenadas no campo', () => {
  assert.deepEqual(Object.keys(FORMATIONS).sort(), ['3-5-2', '4-2-3-1', '4-3-3', '4-4-2', '5-3-2']);
  for (const [name, f] of Object.entries(FORMATIONS)) {
    assert.equal(f.slots.length, 11, name);
    assert.equal(f.slots.filter((s) => s.pos === 'GOL').length, 1, name);
    const outfield = name.split('-').map(Number).reduce((a, b) => a + b, 0);
    assert.equal(outfield, 10, name);
    for (const s of f.slots) assert.ok(s.x >= 0 && s.x <= 1 && s.y >= 0 && s.y <= 1, `${name} ${s.pos}`);
  }
});

test('melhor XI: um jogador por vaga, sem repetir, pela posição certa quando dá', () => {
  for (const name of Object.keys(FORMATIONS)) {
    const xi = pickLineup(squad, name);
    assert.equal(xi.length, 11);
    assert.equal(new Set(xi.map((p) => p.id)).size, 11);
    const slots = FORMATIONS[name].slots.map((s) => s.pos).sort();
    assert.deepEqual(xi.map((p) => p.pos).sort(), slots, name);
    assert.ok(xi.every((p) => p.natural === p.pos), `${name}: todos na posição natural`);
  }
});

test('o melhor da posição entra: o reserva de nota menor fica fora', () => {
  const strong = createSquadPlayer({ name: 'Bom', pos: 'GOL', age: 27, number: 90, quality: 85 }, { clubId: 'c', level: 68 });
  const weak = createSquadPlayer({ name: 'Fraco', pos: 'GOL', age: 27, number: 91, quality: 50 }, { clubId: 'c', level: 68 });
  const xi = pickLineup([...squad.filter((p) => p.pos !== 'GOL'), weak, strong], '4-4-2');
  assert.equal(xi.find((p) => p.pos === 'GOL').name, 'Bom');
});

test('fora de posição rende menos; posição vizinha é melhor que distante', () => {
  assert.equal(positionFit('ZAG', 'ZAG'), 1);
  assert.ok(positionFit('LAT', 'ZAG') > positionFit('ATA', 'ZAG'));
  assert.ok(positionFit('MEI', 'ATA') > positionFit('GOL', 'ATA'));
  // Sem lateral no elenco: alguém joga improvisado e o time perde força defensiva.
  const noLat = squad.filter((p) => p.pos !== 'LAT');
  const xi = pickLineup(noLat, '4-4-2');
  const improvised = xi.filter((p) => p.natural !== p.pos);
  assert.equal(improvised.length, 2);
  const full = teamStrength({ formation: '4-4-2', lineup: pickLineup(squad, '4-4-2') });
  const weak = teamStrength({ formation: '4-4-2', lineup: xi });
  assert.ok(weak.defense < full.defense);
});

test('formação pesa: 4-3-3 ataca mais que 5-3-2; 5-3-2 defende mais', () => {
  const s433 = teamStrength({ formation: '4-3-3', lineup: pickLineup(squad, '4-3-3') });
  const s532 = teamStrength({ formation: '5-3-2', lineup: pickLineup(squad, '5-3-2') });
  assert.ok(s433.attack > s532.attack, `ataque 433 ${s433.attack} x 532 ${s532.attack}`);
  assert.ok(s532.defense > s433.defense, `defesa 532 ${s532.defense} x 433 ${s433.defense}`);
});

test('posição genérica da fonte (DF/MF) joga sem punição nas vagas que ela cobre', () => {
  const broad = ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'DF', 'MF', 'FW']
    .map((pos, i) => createSquadPlayer({ name: `G${i}`, pos, age: 26, number: i + 1 }, { clubId: 'g', level: 68 }));
  const xi = pickLineup(broad, '4-4-2');
  assert.equal(xi.length, 11);
  assert.ok(xi.every((p) => p.fit === 1), xi.map((p) => `${p.natural}->${p.pos}:${p.fit}`).join(' '));
  assert.deepEqual(broad[1].roles, ['ZAG', 'LAT']);
});
