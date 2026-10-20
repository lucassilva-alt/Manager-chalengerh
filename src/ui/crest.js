// Escudo desenhado por código: forma de escudo, cores do clube e sigla.
import { h } from 'preact';
import htm from 'htm';

const html = htm.bind(h);
const SHIELD = 'M50 4 L92 16 V52 C92 76 72 92 50 98 C28 92 8 76 8 52 V16 Z';

export function Crest({ team, size = 48 }) {
  const { shirt, shorts } = team.colors;
  const id = `crest-${team.id}`;
  return html`
    <svg class="crest" width=${size} height=${size} viewBox="0 0 100 100" role="img" aria-label=${team.name}>
      <defs><clipPath id=${id}><path d=${SHIELD} /></clipPath></defs>
      <g clip-path=${`url(#${id})`}>
        <rect width="100" height="100" fill=${shirt} />
        <rect x="38" width="24" height="100" fill=${shorts} opacity="0.9" />
      </g>
      <path d=${SHIELD} fill="none" stroke="#fff" stroke-width="5" />
      <text x="50" y="62" text-anchor="middle" font-size="24" font-weight="800" fill="#fff"
        stroke="rgba(0,0,0,0.45)" stroke-width="1.2" font-family="system-ui, sans-serif">${team.short}</text>
    </svg>`;
}
