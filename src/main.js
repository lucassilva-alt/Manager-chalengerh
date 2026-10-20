import { REVISION } from 'three';
import { h, render } from 'preact';
import htm from 'htm';

const html = htm.bind(h);

function App() {
  return html`<main><h1>Manager Challenger</h1></main>`;
}

render(html`<${App} />`, document.getElementById('app'));

window.__app = { ready: true, libs: { three: REVISION, preact: typeof h === 'function' } };
