// Entrevista pós-jogo: uma pergunta, três respostas.
import { h } from 'preact';
import htm from 'htm';
import { t } from '../../i18n/index.js';

const html = htm.bind(h);

export function Interview({ interview, onAnswer }) {
  return html`
    <section class="interview" aria-labelledby="interview-q">
      <p class="interview-tag">${t('interview.title')}</p>
      <h1 id="interview-q">${t(interview.question)}</h1>
      <div class="interview-answers">
        ${interview.answers.map((a) => html`
          <button type="button" class="btn btn-ghost" onClick=${() => onAnswer(a)}>${t(a.text)}</button>`)}
      </div>
    </section>`;
}
