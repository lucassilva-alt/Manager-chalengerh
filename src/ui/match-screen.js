// Tela da partida: placar, campo com notas e energia, relato, controles de
// ritmo/foco/velocidade e, por cima, o lance jogável quando ele acontece.
import { h } from 'preact';
import { useEffect, useReducer } from 'preact/hooks';
import htm from 'htm';
import { setTactics } from '../engine/match-sim.js';
import { Crest } from './crest.js';
import { HighlightStage } from './highlight-stage.js';
import { describeEvent } from './commentary.js';
import { t } from '../i18n/index.js';

const html = htm.bind(h);
const FOCUS_ORDER = ['defense', 'balanced', 'attack'];
const FAST = 4;
const LINES = [['ATA'], ['MEI', 'VOL'], ['LAT', 'ZAG'], ['GOL']];

function useFlow(flow) {
  const [, bump] = useReducer((n) => n + 1, 0);
  useEffect(() => flow.subscribe(bump), [flow]);
  useEffect(() => {
    let last = performance.now(), raf = 0;
    const loop = (now) => {
      flow.tick(Math.min(0.25, (now - last) / 1000));
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [flow]);
}

const energyLevel = (e) => (e >= 70 ? 'high' : e >= 45 ? 'mid' : 'low');

function PitchPanel({ match, side }) {
  const team = match[side];
  const goals = (id) => match.events.filter((e) => e.type === 'goal' && e.playerId === id).length;
  const avgEnergy = team.lineup.reduce((s, p) => s + match.energy[p.id], 0) / team.lineup.length;
  return html`
    <section class="pitch-panel" aria-label=${team.name}>
      ${LINES.map((positions) => html`
        <div class="pitch-line">
          ${team.lineup.filter((p) => positions.includes(p.pos)).map((p) => html`
            <div class="chip">
              <span class="chip-rating">${match.ratings[p.id].toFixed(1)}</span>
              <span class="chip-badge" style=${`--kit:${team.colors.shirt}`}>${p.number}</span>
              <span class="chip-name">${p.name}${goals(p.id) ? html` <span aria-label="gols">⚽${goals(p.id) > 1 ? goals(p.id) : ''}</span>` : ''}</span>
              <span class=${`chip-energy ${energyLevel(match.energy[p.id])}`} role="meter" aria-label="energia"
                aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(match.energy[p.id])}>
                <span style=${`width:${match.energy[p.id]}%`}></span>
              </span>
            </div>`)}
        </div>`)}
      <p class="team-energy" title=${t('match.teamEnergy')}>
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>
        <span class="sr-only">${t('match.teamEnergy')}:</span> ${avgEnergy.toFixed(1)}
      </p>
    </section>`;
}

function Feed({ match }) {
  const items = match.events.map((e) => ({ e, text: describeEvent(e, match) })).filter((x) => x.text).reverse();
  return html`
    <ol class="feed" aria-live="polite">
      ${items.length === 0 && html`<li class="muted">${t('match.feedEmpty')}</li>`}
      ${items.map(({ e, text }) => html`
        <li class=${`feed-item ${e.type}`}><span class="minute">${e.minute}'</span> ${text}</li>`)}
    </ol>`;
}

function Stepper({ label, value, onDown, onUp, downLabel, upLabel, children }) {
  return html`
    <div class="stepper">
      <button type="button" class="btn btn-icon" aria-label=${downLabel} onClick=${onDown}>−</button>
      <div class="stepper-body"><span class="stepper-label">${label}</span>${children ?? value}</div>
      <button type="button" class="btn btn-icon" aria-label=${upLabel} onClick=${onUp}>+</button>
    </div>`;
}

function HighlightResult({ flow }) {
  const kick = flow.world?.lastKick;
  const outcome = flow.lastOutcome;
  return html`
    <div class="hl-result" role="dialog" aria-label=${t(`highlight.${outcome}`)}>
      <p class=${`hl-result-title ${outcome}`}>${t(`highlight.${outcome}`)}</p>
      ${kick?.type === 'shot' && html`<p class="hl-result-distance">${t('highlight.distance', { meters: kick.distance.toFixed(1) })}</p>`}
      <div class="hl-result-actions">
        ${flow.canRewind && html`
          <button type="button" class="btn btn-ghost" onClick=${() => flow.rewind()}>
            ${t('highlight.rewind', { left: flow.match.rewindsLeft })}
          </button>`}
        <button type="button" class="btn btn-primary" onClick=${() => flow.continueAfterHighlight()}>${t('common.continue')}</button>
      </div>
    </div>`;
}

export function MatchScreen({ flow, onEnd, onHighlightView }) {
  useFlow(flow);
  const m = flow.match, user = m.userSide;
  const tactics = m.tactics[user];
  const running = flow.state === 'running';
  useEffect(() => { if (flow.state === 'ended') onEnd?.(); }, [flow.state]);

  const shiftFocus = (d) => {
    const i = FOCUS_ORDER.indexOf(tactics.focus) + d;
    setTactics(m, user, { focus: FOCUS_ORDER[Math.max(0, Math.min(2, i))] });
    flow.setSpeed(flow.speed); // força redesenho
  };
  const changeWorkRate = (d) => { setTactics(m, user, { workRate: tactics.workRate + d }); flow.setSpeed(flow.speed); };
  const half = m.phase === 'second' || m.phase === 'ended' ? t('match.half2') : t('match.half1');
  const showStage = flow.world && (flow.state === 'highlight' || flow.state === 'highlightResult');

  return html`
    <div class="match-screen">
      <header class="scoreboard">
        <div class="sb-team"><${Crest} team=${m.home} size=${32} /><span>${m.home.name}</span></div>
        <p class="sb-score" aria-label="placar">${m.score.home} – ${m.score.away}</p>
        <div class="sb-team away"><span>${m.away.name}</span><${Crest} team=${m.away} size=${32} /></div>
      </header>

      <main class="match-body">
        <${PitchPanel} match=${m} side=${user} />
        <section class="feed-panel">
          <div class="clock-bar">
            <span>${flow.state === 'halftime' ? t('match.halftime') : half}</span>
            <span class="clock" aria-label="relógio">${flow.clock()}</span>
            <button type="button" class=${`btn btn-icon ${flow.speed > 1 ? 'is-on' : ''}`}
              aria-label=${flow.speed > 1 ? t('match.normalSpeed') : t('match.faster')}
              aria-pressed=${flow.speed > 1}
              onClick=${() => flow.setSpeed(flow.speed > 1 ? 1 : FAST)}>»</button>
          </div>
          ${flow.state === 'halftime' && html`
            <div class="halftime-card">
              <p>${t('match.halftimeNote')}</p>
              <button type="button" class="btn btn-primary" onClick=${() => flow.startSecondHalf()}>${t('match.startSecondHalf')}</button>
            </div>`}
          <${Feed} match=${m} />
        </section>
      </main>

      <footer class="match-controls">
        <${Stepper} label=${t('match.workRate')} downLabel=${t('match.workRateDown')} upLabel=${t('match.workRateUp')}
          onDown=${() => changeWorkRate(-1)} onUp=${() => changeWorkRate(1)}>
          <span class="bar10" role="meter" aria-valuemin="1" aria-valuemax="10" aria-valuenow=${tactics.workRate} aria-label=${t('match.workRate')}>
            ${Array.from({ length: 10 }, (_, i) => html`<i class=${i < tactics.workRate ? 'on' : ''}></i>`)}
          </span>
        <//>
        <${Stepper} label=${t('match.focus')} downLabel=${t('match.focusDown')} upLabel=${t('match.focusUp')}
          onDown=${() => shiftFocus(-1)} onUp=${() => shiftFocus(1)} value=${t(`match.focus.${tactics.focus}`)} />
        <button type="button" class="btn btn-ghost" onClick=${() => flow.simulateRest()}>${t('match.simulateRest')}</button>
        ${flow.state === 'ready' || flow.state === 'paused'
          ? html`<button type="button" class="btn btn-primary" onClick=${() => flow.play()}>${flow.state === 'ready' ? t('common.play') : t('common.resume')}</button>`
          : html`<button type="button" class="btn btn-danger" disabled=${!running} onClick=${() => flow.pause()}>${t('common.pause')}</button>`}
      </footer>

      ${showStage && html`
        <${HighlightStage} world=${flow.world} teams=${{ home: m.home, away: m.away }}
          finished=${flow.state === 'highlightResult'}
          onView=${onHighlightView}
          onEnd=${() => flow.endHighlight()}
          onSkip=${() => flow.skipHighlight()}>
          ${flow.state === 'highlightResult' && html`<${HighlightResult} flow=${flow} />`}
        <//>`}
    </div>`;
}
