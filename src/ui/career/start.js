// Tela inicial: nova carreira, continuar a salva ou partida rápida.
import { h } from 'preact';
import htm from 'htm';
import { t } from '../../i18n/index.js';

const html = htm.bind(h);

export function StartScreen({ hasSave, onNew, onContinue, onQuick }) {
  return html`
    <section class="start-screen" aria-labelledby="start-title">
      <h1 id="start-title" class="start-title">Manager Challenger</h1>
      <div class="start-actions">
        ${hasSave && html`<button type="button" class="btn btn-primary btn-lg" onClick=${onContinue}>${t('career.continue')}</button>`}
        <button type="button" class=${`btn btn-lg ${hasSave ? 'btn-ghost' : 'btn-primary'}`} onClick=${onNew}>${t('career.new')}</button>
        <button type="button" class="btn btn-ghost" onClick=${onQuick}>${t('career.quick')}</button>
      </div>
    </section>`;
}
