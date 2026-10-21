// Classificação: posição, clube, jogos, vitórias, empates, derrotas, saldo, pontos.
import { h } from 'preact';
import htm from 'htm';
import { Crest } from '../crest.js';
import { standings } from '../../engine/league.js';
import { t } from '../../i18n/index.js';

const html = htm.bind(h);
const ZONE = 4; // acesso/Libertadores no topo e rebaixamento no fim

export function LeagueTable({ table, teams, highlight }) {
  const rows = standings(table);
  return html`
    <table class="league-table">
      <thead><tr>
        <th scope="col">#</th><th scope="col" class="lt-club">${t('table.club')}</th>
        <th scope="col" title=${t('table.playedLong')}>J</th><th scope="col" title=${t('table.wonLong')}>V</th>
        <th scope="col" title=${t('table.drawnLong')}>E</th><th scope="col" title=${t('table.lostLong')}>D</th>
        <th scope="col" title=${t('table.gdLong')}>SG</th><th scope="col" title=${t('table.pointsLong')}>P</th>
      </tr></thead>
      <tbody>
        ${rows.map((r, i) => {
          const team = teams[r.id];
          const zone = i < ZONE ? 'zone-top' : i >= rows.length - ZONE ? 'zone-bottom' : '';
          return html`
            <tr class=${`${zone}${r.id === highlight ? ' mine' : ''}`}>
              <td>${i + 1}</td>
              <td class="lt-club"><${Crest} team=${team} size=${20} /> ${team.name}</td>
              <td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td>
              <td>${r.gf - r.ga}</td><td><strong>${r.points}</strong></td>
            </tr>`;
        })}
      </tbody>
    </table>`;
}
