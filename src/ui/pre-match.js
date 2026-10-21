// Apresentação antes do jogo: escudos, nomes e Jogar.
import { h } from 'preact';
import htm from 'htm';
import { Crest } from './crest.js';
import { t } from '../i18n/index.js';

const html = htm.bind(h);

export function PreMatch({ home, away, onPlay, provisional = false }) {
  return html`
    <section class="pre-match" aria-labelledby="pre-title">
      <h1 id="pre-title" class="sr-only">${home.name} ${t('pre.vs')} ${away.name}</h1>
      <div class="pre-teams">
        <div class="pre-team"><${Crest} team=${home} size=${112} /><span>${home.name}</span></div>
        <span class="pre-vs" aria-hidden="true">${t('pre.vs')}</span>
        <div class="pre-team"><${Crest} team=${away} size=${112} /><span>${away.name}</span></div>
      </div>
      ${provisional ? html`<p class="pre-note">${t('pre.provisional')}</p>` : home.stadium && html`<p class="pre-note">${home.stadium.name} · ${home.stadium.city}</p>`}
      <button type="button" class="btn btn-primary btn-lg" onClick=${onPlay}>${t('common.play')}</button>
    </section>`;
}
