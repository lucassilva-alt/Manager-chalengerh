// Palco do lance: monta a vista 3D e a interface por cima (dica, Cancelar,
// Simular lance). `children` entra por cima do 3D (ex.: resultado do lance).
import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import htm from 'htm';
import { createHighlightView } from '../render/highlight-view.js';
import { loadPlayerAsset } from '../render/player-model.js';
import { QUALITY } from '../render/quality.js';

// ?quality=high|medium|low fixa o nível gráfico (prints, testes); sem ele é automático.
const FIXED_QUALITY = { high: QUALITY.HIGH, medium: QUALITY.MEDIUM, low: QUALITY.LOW }[new URLSearchParams(location.search).get('quality')] ?? null;
import { t } from '../i18n/index.js';

const html = htm.bind(h);

function hintFor(world, shotUi) {
  if (world.mode === 'penalty') return t('highlight.penaltyHint');
  if (world.mode === 'penaltyDefense') return t('highlight.penaltyDefenseHint');
  if (shotUi) return t('highlight.swipeHint');
  return world.mode === 'defense' ? t('highlight.defenseHint') : t('highlight.planHint');
}

export function HighlightStage({ world, teams, scorebug = null, onView, onEnd, onSkip, finished = false, children }) {
  const host = useRef(null);
  const view = useRef(null);
  const [shotUi, setShotUi] = useState(false);
  const [awaiting, setAwaiting] = useState(true);

  useEffect(() => {
    let v = null, off = null, cancelled = false;
    // Sem o modelo (ex.: falha de rede) o lance segue com os bonecos simples.
    loadPlayerAsset().catch(() => null).then((asset) => {
      if (cancelled) return;
      v = createHighlightView(host.current, { world, teams, onShotUi: setShotUi, asset, quality: FIXED_QUALITY });
      view.current = v;
      onView?.(v);
      let ended = false;
      off = v.onFrame((w) => {
        setAwaiting(w.awaitingInput && w.status === 'live'); // Preact ignora valor igual
        if (!ended && w.status !== 'live') { ended = true; onEnd?.(w); }
      });
    });
    return () => { cancelled = true; off?.(); v?.dispose(); };
  }, [world]);

  return html`
    <div class="stage" ref=${host}>
      ${scorebug && html`
        <div class="hl-scorebug" aria-label="placar">
          <span class="sb-tag" style=${`background:${scorebug.home.colors.shirt}`}>${scorebug.home.short}</span>
          <span class="hl-scorebug-score">${scorebug.score.home}–${scorebug.score.away}</span>
          <span class="sb-tag" style=${`background:${scorebug.away.colors.shirt}`}>${scorebug.away.short}</span>
          <span class="hl-scorebug-min">${scorebug.minute}'</span>
        </div>`}
      ${!finished && (awaiting || shotUi) && html`
        <p class="hl-hint" aria-live="polite">${hintFor(world, shotUi)}</p>`}
      ${!finished && awaiting && world.mode === 'penaltyDefense' && html`
        <div class="hl-dive" role="group" aria-label=${t('highlight.diveGroup')}>
          ${[[-1, 'diveLeft'], [0, 'diveCenter'], [1, 'diveRight']].map(([dir, key]) => html`
            <button type="button" class="btn btn-ghost" onClick=${() => view.current?.input({ type: 'go', dive: dir })}>${t(`highlight.${key}`)}</button>`)}
        </div>`}
      ${!finished && awaiting && world.mode === 'defense' && html`
        <button type="button" class="btn btn-primary hl-go" onClick=${() => view.current?.input({ type: 'go' })}>${t('highlight.start')}</button>`}
      ${!finished && !shotUi && !world.penalty && onSkip && html`
        <button type="button" class="btn btn-ghost hl-skip" onClick=${onSkip}>${t('highlight.simulate')}</button>`}
      ${shotUi && !world.penalty && html`
        <button type="button" class="btn btn-danger hl-cancel" onClick=${() => view.current?.cancelShot()}>
          ${t('common.cancel')}
        </button>`}
      ${children}
    </div>`;
}
