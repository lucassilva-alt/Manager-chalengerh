// Palco do lance: monta a vista 3D e a interface por cima (dica, Cancelar).
import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import htm from 'htm';
import { createHighlightView } from '../render/highlight-view.js';
import { t } from '../i18n/index.js';

const html = htm.bind(h);

export function HighlightStage({ world, teams, onView, onEnd }) {
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
      <p class="hl-hint" aria-live="polite">${shotUi ? t('highlight.swipeHint') : t('highlight.planHint')}</p>
      ${shotUi && html`
        <button type="button" class="btn btn-danger hl-cancel" onClick=${() => view.current?.cancelShot()}>
          ${t('common.cancel')}
        </button>`}
    </div>`;
}
