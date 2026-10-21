// Entrevista pós-jogo: uma pergunta pelo resultado e três respostas, cada uma
// com efeito na moral do elenco, no humor da torcida e na confiança da diretoria.
const INTERVIEWS = {
  win: [
    { id: 'humble', effect: { morale: 2, fans: 1, board: 2 } },
    { id: 'bold', effect: { morale: 4, fans: 4, board: -1 } },
    { id: 'squad', effect: { morale: 5, fans: 1, board: 0 } },
  ],
  draw: [
    { id: 'positive', effect: { morale: 2, fans: -1, board: 0 } },
    { id: 'demand', effect: { morale: -1, fans: 2, board: 2 } },
    { id: 'referee', effect: { morale: 1, fans: 2, board: -2 } },
  ],
  loss: [
    { id: 'own', effect: { morale: 3, fans: 1, board: -3 } },
    { id: 'blame', effect: { morale: -5, fans: 0, board: 3 } },
    { id: 'next', effect: { morale: 1, fans: -2, board: 0 } },
  ],
};

export function interviewFor({ goalsFor, goalsAgainst }) {
  const result = goalsFor > goalsAgainst ? 'win' : goalsFor < goalsAgainst ? 'loss' : 'draw';
  return { result, question: `interview.${result}.question`, answers: INTERVIEWS[result].map((a) => ({ ...a, text: `interview.${result}.${a.id}` })) };
}

const clamp = (v) => Math.max(0, Math.min(100, v));

export function applyAnswer(state, answer) {
  const { morale, fans, board } = answer.effect;
  return {
    ...state,
    morale: Object.fromEntries(Object.entries(state.morale).map(([id, v]) => [id, clamp(v + morale)])),
    fans: clamp(state.fans + fans),
    board: clamp(state.board + board),
  };
}
