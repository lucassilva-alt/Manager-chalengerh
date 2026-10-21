// B1: jogador do elenco — atributos estimados pelo jogo a partir do perfil real
// (posição, idade) e do nível do clube; potencial, traços, moral e forma.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ratePlayer, overall, createSquadPlayer, mapPosition, TRAITS } from '../../src/engine/player.js';

const ATTRS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'goalkeeping'];

test('mesma semente = mesmos atributos; todos entre 1 e 99', () => {
  const a = ratePlayer({ pos: 'MEI', age: 26, quality: 70, seed: 'pal-10' });
  const b = ratePlayer({ pos: 'MEI', age: 26, quality: 70, seed: 'pal-10' });
  assert.deepEqual(a, b);
  for (const k of ATTRS) assert.ok(a.attrs[k] >= 1 && a.attrs[k] <= 99, `${k}=${a.attrs[k]}`);
});

test('perfil da posição: atacante finaliza, zagueiro defende, goleiro só no gol', () => {
  const ata = ratePlayer({ pos: 'ATA', age: 26, quality: 70, seed: 1 }).attrs;
  const zag = ratePlayer({ pos: 'ZAG', age: 26, quality: 70, seed: 1 }).attrs;
  const gol = ratePlayer({ pos: 'GOL', age: 26, quality: 70, seed: 1 }).attrs;
  assert.ok(ata.shooting > ata.defending + 15);
  assert.ok(zag.defending > zag.shooting + 15);
  assert.ok(gol.goalkeeping >= 60 && ATTRS.filter((k) => k !== 'goalkeeping' && k !== 'physical').every((k) => gol[k] <= 45));
});

test('no auge da idade a nota geral fica perto da qualidade pedida', () => {
  for (const pos of ['GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'ATA']) {
    let sum = 0;
    for (let s = 0; s < 40; s++) sum += overall({ pos, ...ratePlayer({ pos, age: 27, quality: 72, seed: s }) });
    const mean = sum / 40;
    assert.ok(Math.abs(mean - 72) <= 3, `${pos}: média ${mean.toFixed(1)}`);
  }
});

test('idade: jovem rende menos hoje mas tem potencial maior; veterano não cresce', () => {
  let young = 0, prime = 0, youngPot = 0, oldGap = 0;
  for (let s = 0; s < 40; s++) {
    const y = ratePlayer({ pos: 'MEI', age: 18, quality: 72, seed: s });
    const p = ratePlayer({ pos: 'MEI', age: 27, quality: 72, seed: s });
    const o = ratePlayer({ pos: 'MEI', age: 34, quality: 72, seed: s });
    young += overall({ pos: 'MEI', ...y }); prime += overall({ pos: 'MEI', ...p });
    youngPot += y.potential - overall({ pos: 'MEI', ...y });
    oldGap = Math.max(oldGap, o.potential - overall({ pos: 'MEI', ...o }));
  }
  assert.ok(young < prime - 4 * 40, 'jovem abaixo do auge');
  assert.ok(youngPot / 40 >= 8, `jovem cresce ${youngPot / 40}`);
  assert.ok(oldGap <= 0, 'veterano sem crescimento');
});

test('jogador do elenco: dados reais preservados, traços sem repetição, moral e forma iniciais', () => {
  const p = createSquadPlayer({ name: 'Fulano de Tal', pos: 'Volante', age: 24, number: 5, nationality: 'Brasil' }, { clubId: 'x', level: 68 });
  assert.equal(p.name, 'Fulano de Tal');
  assert.equal(p.pos, 'VOL');
  assert.equal(p.number, 5);
  assert.equal(p.age, 24);
  assert.equal(p.id, 'x-5');
  assert.ok(p.traits.length <= 2 && new Set(p.traits).size === p.traits.length);
  assert.ok(p.traits.every((t) => TRAITS.includes(t)));
  assert.equal(p.morale, 70);
  assert.deepEqual(p.form, []);
  assert.equal(p.fitness, 100);
  assert.equal(p.injury, null);
});

test('qualidade com fonte no cadastro vence o nível do clube', () => {
  const p = createSquadPlayer({ name: 'Craque', pos: 'ATA', age: 27, number: 9, quality: 84 }, { clubId: 'x', level: 66 });
  assert.ok(Math.abs(overall(p) - 84) <= 6, `geral ${overall(p)}`);
});

test('posições escritas de vários jeitos viram as 6 do jogo', () => {
  const cases = {
    Goleiro: 'GOL', GK: 'GOL', Zagueiro: 'ZAG', CB: 'ZAG', 'Lateral-direito': 'LAT', 'Lateral-esquerdo': 'LAT', LB: 'LAT', RB: 'LAT',
    Volante: 'VOL', DM: 'VOL', 'Meio-campista': 'MEI', Meia: 'MEI', CM: 'MEI', AM: 'MEI', Ponta: 'ATA', Atacante: 'ATA',
    Centroavante: 'ATA', 'Ponta-esquerda': 'ATA', LW: 'ATA', RW: 'ATA', ST: 'ATA', CF: 'ATA',
    'Meia Central': 'MEI', 'Meia Ofensivo': 'MEI', 'Lateral Esq.': 'LAT', 'Lateral Dir.': 'LAT',
  };
  for (const [raw, pos] of Object.entries(cases)) assert.equal(mapPosition(raw), pos, raw);
  assert.equal(mapPosition('???'), null);
});
