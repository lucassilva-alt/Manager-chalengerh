// B6: o relato narra cartões e lesões, inclusive de quem já saiu de campo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeEvent } from '../../src/ui/commentary.js';
import { createMatch, bookPlayer } from '../../src/engine/match-sim.js';
import { makeTeam } from '../engine/helpers.js';

test('amarelo, vermelho (também do expulso) e lesão viram texto com o nome', () => {
  const m = createMatch({ home: makeTeam('A', 65), away: makeTeam('B', 65), seed: 1 });
  const zag = m.home.lineup.find((p) => p.pos === 'ZAG');
  bookPlayer(m, 'home', zag.id, 'yellow');
  bookPlayer(m, 'home', zag.id, 'yellow');
  const [y1, , red] = m.events.slice(-3);
  assert.equal(describeEvent(y1, m), `Cartão amarelo para ${zag.name}.`);
  assert.equal(describeEvent(red, m), `Segundo amarelo: ${zag.name} expulso!`);
  const inj = { minute: 30, type: 'injury', side: 'away', playerId: m.away.lineup[3].id, weeks: 2 };
  assert.equal(describeEvent(inj, m), `${m.away.lineup[3].name} sente lesão e pede atendimento.`);
});
