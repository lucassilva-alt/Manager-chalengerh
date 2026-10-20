// Tela final: placar, autores dos gols e melhor em campo.
import { h } from 'preact';
import htm from 'htm';
import { Crest } from './crest.js';
import { t } from '../i18n/index.js';

const html = htm.bind(h);

export function ResultScreen({ match, onAgain }) {
  const goals = match.events.filter((e) => e.type === 'goal');
  const players = [...match.home.lineup, ...match.away.lineup];
  const nameOf = (id) => players.find((p) => p.id === id)?.name ?? id;
  const best = players.reduce((a, b) => (match.ratings[b.id] > match.ratings[a.id] ? b : a));
  return html`
    <section class="result-screen" aria-labelledby="result-title">
      <h1 id="result-title">${t('result.title')}</h1>
      <div class="result-board">
        <${Crest} team=${match.home} size=${64} />
        <p class="result-score" aria-label=${`${match.home.name} ${match.score.home}, ${match.away.name} ${match.score.away}`}>
          ${match.score.home} <span aria-hidden="true">x</span> ${match.score.away}
        </p>
        <${Crest} team=${match.away} size=${64} />
      </div>
      <h2>${t('result.scorers')}</h2>
      ${goals.length
        ? html`<ul class="result-goals">${goals.map((g) => html`
            <li><span class="minute">${g.minute}'</span> ${nameOf(g.playerId)} <span class="muted">(${match[g.side].short})</span></li>`)}
          </ul>`
        : html`<p class="muted">${t('result.noGoals')}</p>`}
      <p class="result-best">${t('result.best')}: <strong>${best.name}</strong> · ${match.ratings[best.id].toFixed(1)}</p>
      <button type="button" class="btn btn-primary btn-lg" onClick=${onAgain}>${t('result.again')}</button>
    </section>`;
}
