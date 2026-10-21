// Escolher o clube: abas Série A / Série B, cartões com escudo real.
import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { Crest } from '../crest.js';
import { t } from '../../i18n/index.js';

const html = htm.bind(h);

export function ClubPicker({ clubs, onPick, onBack }) {
  const [division, setDivision] = useState('A');
  const [chosen, setChosen] = useState(null);
  const list = clubs.filter((c) => c.division === division).sort((a, b) => a.name.localeCompare(b.name));
  return html`
    <section class="club-picker" aria-labelledby="picker-title">
      <header class="picker-head">
        <button type="button" class="btn btn-ghost" onClick=${onBack}>${t('common.back')}</button>
        <h1 id="picker-title">${t('career.pickTitle')}</h1>
      </header>
      <div class="tabs" role="tablist" aria-label=${t('career.division')}>
        ${['A', 'B'].map((d) => html`
          <button type="button" role="tab" aria-selected=${division === d ? 'true' : 'false'} class="tab"
            onClick=${() => { setDivision(d); setChosen(null); }}>${t(`career.serie${d}`)}</button>`)}
      </div>
      <div class="club-grid" role="tabpanel">
        ${list.map((c) => html`
          <button type="button" class=${`club-card${chosen === c.id ? ' selected' : ''}`} aria-pressed=${chosen === c.id ? 'true' : 'false'}
            onClick=${() => setChosen(c.id)}>
            <${Crest} team=${c} size=${56} />
            <span class="club-name">${c.name}</span>
            <span class="club-meta">${c.city}-${c.state} · ${c.stadium}</span>
          </button>`)}
      </div>
      <footer class="picker-foot">
        <button type="button" class="btn btn-primary btn-lg" disabled=${!chosen} onClick=${() => onPick(chosen)}>${t('career.start')}</button>
      </footer>
    </section>`;
}
