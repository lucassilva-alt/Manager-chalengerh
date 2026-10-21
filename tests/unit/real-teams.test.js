// E3: clube real + elenco da fonte → time do jogo (XI, banco, idade na data).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTeam, ageOn } from '../../src/data/real-teams.js';
import { mapPosition } from '../../src/engine/player.js';

const club = { id: 'clube-x', name: 'Clube X', short: 'CLX', colors: { shirt: '#112233', shorts: '#ffffff' }, crest: 'clube-x', stadium: 'Estádio X', capacity: 30000, division: 'A' };
const POS = ['Goleiro', 'Goleiro', 'Zagueiro', 'Zagueiro', 'Zagueiro', 'Lateral-direito', 'Lateral-esquerdo', 'Volante', 'Volante', 'Meia', 'Meia', 'Meia', 'Atacante', 'Atacante', 'Atacante', 'Ponta', 'Lateral-direito', 'Zagueiro', 'Volante', 'Meia', 'Atacante', 'GK', 'DF', 'MF', 'FW'];
const squad = { club: 'clube-x', source: 'https://exemplo', players: POS.map((pos, i) => ({ name: `Teste ${i + 1}`, pos, number: i < 23 ? i + 1 : null, birthDate: i === 0 ? null : `${1990 + (i % 15)}-06-15`, nationality: 'Brasil' })) };

test('idade na data da temporada', () => {
  assert.equal(ageOn('2000-06-15', '2026-10-21'), 26);
  assert.equal(ageOn('2000-12-01', '2026-10-21'), 25);
  assert.equal(ageOn(null, '2026-10-21'), null);
});

test('posições curtas da fonte (GK/DF/MF/FW) viram as do jogo', () => {
  assert.deepEqual(['GK', 'DF', 'MF', 'FW'].map(mapPosition), ['GOL', 'ZAG', 'MEI', 'ATA']);
});

test('time montado: dados do clube, XI de 11 pela formação, banco de até 12, ids únicos', () => {
  const t = buildTeam(club, squad, { asOf: '2026-10-21' });
  assert.equal(t.name, 'Clube X');
  assert.equal(t.short, 'CLX');
  assert.equal(t.crest, 'clube-x');
  assert.equal(t.colors.socks, '#112233');
  assert.equal(t.stadium.name, 'Estádio X');
  assert.equal(t.squad.length, POS.length);
  assert.equal(t.lineup.length, 11);
  assert.ok(t.bench.length <= 12 && t.bench.length > 0);
  const ids = t.squad.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(t.lineup.every((p) => !t.bench.some((b) => b.id === p.id)));
  assert.equal(t.squad[0].age, null);
  assert.equal(t.source, 'https://exemplo');
});
