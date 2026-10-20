// Palco do lance: monta a vista 3D e a interface por cima (dica, Cancelar,
// Simular lance). `children` entra por cima do 3D (ex.: resultado do lance).
import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import htm from 'htm';
import { createHighlightView } from '../render/highlight-view.js';
import { t } from '../i18n/index.js';

const html = htm.bind(h);

export function HighlightStage({ world, teams, onView, onEnd, onSkip, finished = false, children }) {
  const host = useRef(null);
  const view = useRef(null);
  const [shotUi, setShotUi] = useState(false);

  useEffect(() => {
    const v = createHighlightView(host.current, { world, teams, onShotUi: setShotUi });
    view.current = v;
    onView?.(v);
    let ended = false;
    const off = v.onFrame((w) => {
      if (!ended && w.status !== 'live') { ended = true; onEnd?.(w); }
    });
    return () => { off(); v.dispose(); };
  }, [world]);

  return html`
    <div class="stage" ref=${host}>
      ${!finished && html`
        <p class="hl-hint" aria-live="polite">${shotUi ? t('highlight.swipeHint') : t('highlight.planHint')}</p>`}
      ${!finished && !shotUi && onSkip && html`
        <button type="button" class="btn btn-ghost hl-skip" onClick=${onSkip}>${t('highlight.simulate')}</button>`}
      ${shotUi && html`
        <button type="button" class="btn btn-danger hl-cancel" onClick=${() => view.current?.cancelShot()}>
          ${t('common.cancel')}
        </button>`}
      ${children}
    </div>`;
}
