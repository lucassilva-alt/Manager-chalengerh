// Central do clube: rodada, próximo jogo, classificação e elenco.
import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { Crest } from '../crest.js';
import { LeagueTable } from './league-table.js';
import { nextFixture, userDivision } from '../../engine/career.js';
import { overall } from '../../engine/player.js';
import { t } from '../../i18n/index.js';

const html = htm.bind(h);
const POS_ORDER = ['GOL', 'ZAG', 'LAT', 'VOL', 'MEI', 'ATA'];

function NextMatch({ career, onPlay, onNextSeason }) {
  const f = nextFixture(career);
  if (!f) return html`<div class="next-match"><p class="muted">${t('career.seasonOver')}</p>
    ${onNextSeason && html`<button type="button" class="btn btn-primary btn-lg" onClick=${onNextSeason}>${t('career.nextSeason')}</button>`}</div>`;
  const home = career.teams[f.home], away = career.teams[f.away];
  const atHome = f.home === career.clubId;
  return html`
    <div class="next-match">
      <p class="nm-tag">${atHome ? t('career.home') : t('career.away')} · ${home.stadium.name}</p>
      <div class="nm-teams">
        <div class="nm-team"><${Crest} team=${home} size=${72} /><span>${home.name}</span></div>
        <span class="pre-vs" aria-hidden="true">${t('pre.vs')}</span>
        <div class="nm-team"><${Crest} team=${away} size=${72} /><span>${away.name}</span></div>
      </div>
      <button type="button" class="btn btn-primary btn-lg" onClick=${onPlay}>${t('career.goToMatch')}</button>
    </div>`;
}

function SquadList({ team }) {
  const players = [...team.squad].sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || overall(b) - overall(a));
  const ages = players.some((p) => p.age !== null); // fonte sem data de nascimento: sem coluna
  return html`
    <table class="squad-table">
      <thead><tr>
        <th scope="col">Nº</th><th scope="col">${t('squad.name')}</th><th scope="col">${t('squad.pos')}</th>
        ${ages && html`<th scope="col">${t('squad.age')}</th>`}<th scope="col">${t('squad.overall')}</th>
      </tr></thead>
      <tbody>${players.map((p) => html`
        <tr><td>${p.number ?? '—'}</td><td>${p.name}</td><td>${t(`pos.${p.pos}`)}</td>${ages && html`<td>${p.age ?? '—'}</td>`}<td>${overall(p)}</td></tr>`)}
      </tbody>
    </table>
    <p class="muted small">${t('squad.source')} <a href=${team.source} target="_blank" rel="noopener">${new URL(team.source).hostname}</a>. ${t('squad.estimate')}</p>`;
}

export function Hub({ career, onPlay, onNextSeason }) {
  const [tab, setTab] = useState('next');
  const team = career.teams[career.clubId];
  const div = userDivision(career);
  const total = career.schedules[div].length;
  const tabs = [['next', t('career.nextMatch')], ['table', t('career.table')], ['squad', t('career.squad')]];
  return html`
    <section class="hub">
      <header class="hub-head">
        <${Crest} team=${team} size=${48} />
        <div>
          <h1>${team.name}</h1>
          <p class="muted">${t('career.season', { season: career.season })} · ${t(`career.serie${div}`)} · ${t('career.round', { round: Math.min(career.round + 1, total), total })}</p>
        </div>
      </header>
      <div class="tabs" role="tablist">
        ${tabs.map(([id, label]) => html`
          <button type="button" role="tab" class="tab" aria-selected=${tab === id ? 'true' : 'false'} onClick=${() => setTab(id)}>${label}</button>`)}
      </div>
      <div class="hub-panel" role="tabpanel">
        ${tab === 'next' && html`<${NextMatch} career=${career} onPlay=${onPlay} onNextSeason=${onNextSeason} />`}
        ${tab === 'table' && html`<${LeagueTable} table=${career.tables[div]} teams=${career.teams} highlight=${career.clubId} />`}
        ${tab === 'squad' && html`<${SquadList} team=${team} />`}
      </div>
    </section>`;
}
