// B7: entrevista pós-jogo — pergunta pelo resultado; resposta mexe em moral,
// torcida e diretoria.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interviewFor, applyAnswer } from '../../src/engine/interview.js';

test('pergunta muda com o resultado e sempre traz 3 respostas', () => {
  const win = interviewFor({ goalsFor: 3, goalsAgainst: 0 });
  const loss = interviewFor({ goalsFor: 0, goalsAgainst: 2 });
  const draw = interviewFor({ goalsFor: 1, goalsAgainst: 1 });
  assert.deepEqual([win.result, loss.result, draw.result], ['win', 'loss', 'draw']);
  for (const q of [win, loss, draw]) assert.equal(q.answers.length, 3);
  assert.notEqual(win.question, loss.question);
});

test('na derrota: assumir a culpa protege o elenco; culpar os jogadores agrada a diretoria e derruba a moral', () => {
  const q = interviewFor({ goalsFor: 0, goalsAgainst: 2 });
  const own = q.answers.find((a) => a.id === 'own');
  const blame = q.answers.find((a) => a.id === 'blame');
  assert.ok(own.effect.morale > 0 && own.effect.board < 0);
  assert.ok(blame.effect.morale < 0 && blame.effect.board > 0);
});

test('aplicar a resposta soma os efeitos e limita entre 0 e 100', () => {
  const state = { morale: { a: 98, b: 50 }, fans: 99, board: 2 };
  const q = interviewFor({ goalsFor: 2, goalsAgainst: 0 });
  const bold = q.answers.find((a) => a.id === 'bold');
  const next = applyAnswer(state, bold);
  assert.ok(next.fans <= 100 && next.board >= 0);
  assert.ok(Object.values(next.morale).every((v) => v >= 0 && v <= 100));
  assert.equal(next.morale.b, Math.min(100, 50 + bold.effect.morale));
  assert.equal(state.fans, 99, 'não altera o estado original');
});
