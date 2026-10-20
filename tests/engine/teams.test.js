import { test } from 'node:test';
import assert from 'node:assert/strict';
import { teamStrength } from '../../src/engine/teams.js';
import { makeTeam } from './helpers.js';

test('time com atributos maiores tem ataque e defesa maiores', () => {
  const strong = teamStrength(makeTeam('A', 80));
  const weak = teamStrength(makeTeam('B', 50));
  assert.ok(strong.attack > weak.attack);
  assert.ok(strong.defense > weak.defense);
});

test('força fica na mesma escala dos atributos (1–99)', () => {
  const s = teamStrength(makeTeam('A', 70));
  assert.ok(Math.abs(s.attack - 70) < 1);
  assert.ok(Math.abs(s.defense - 70) < 1);
});

test('goleiro melhor aumenta a defesa, não o ataque', () => {
  const base = teamStrength(makeTeam('A', 60, { gk: 50 }));
  const goodGk = teamStrength(makeTeam('A', 60, { gk: 90 }));
  assert.ok(goodGk.defense > base.defense);
  assert.equal(goodGk.attack, base.attack);
});

test('energia baixa reduz a força', () => {
  const team = makeTeam('A', 70);
  const fresh = teamStrength(team);
  const tired = teamStrength(team, { energy: Object.fromEntries(team.lineup.map((p) => [p.id, 40])) });
  assert.ok(tired.attack < fresh.attack);
  assert.ok(tired.defense < fresh.defense);
});
