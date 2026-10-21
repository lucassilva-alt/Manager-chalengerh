// ?dev=crests: galeria de todos os escudos importados (conferência visual).
import { h, render } from 'preact';
import htm from 'htm';
import { Crest } from '../ui/crest.js';

const html = htm.bind(h);

export async function devCrests(root) {
  const { crests } = await (await fetch('assets/crests/br/index.json')).json();
  const teams = Object.keys(crests).map((slug) => ({ id: slug, name: slug, short: '', crest: slug, colors: { shirt: '#333', shorts: '#555' } }));
  teams.push({ id: 'nao-existe', name: 'Sem escudo', short: 'SE', crest: 'nao-existe', colors: { shirt: '#2d5fd3', shorts: '#fff' } });
  render(html`
    <main class="crest-gallery">
      ${teams.map((t) => html`<figure><${Crest} team=${t} size=${64} /><figcaption>${t.name}</figcaption></figure>`)}
    </main>`, root);
}
