import { REVISION } from 'three';
import { h, render } from 'preact';
import htm from 'htm';

const html = htm.bind(h);
const params = new URLSearchParams(location.search);

function App() {
  return html`<main><h1>Manager Challenger</h1></main>`;
}

async function devHighlight() {
  const [{ loadDemoTeams }, sim, { startHighlight }, { createHighlightView }] = await Promise.all([
    import('./data/demo.js'),
    import('./engine/match-sim.js'),
    import('./engine/highlight/scenario.js'),
    import('./render/highlight-view.js'),
  ]);
  const [home, away] = await loadDemoTeams();
  const seed = Number(params.get('seed')) || 1;
  const m = sim.createMatch({ home, away, seed, userSide: 'home', interactive: true });
  while (!m.pending && m.phase !== 'ended') {
    if (m.phase === 'halftime') sim.startSecondHalf(m); else sim.advanceMinute(m);
  }
  const world = startHighlight(m, { seed });
  const stage = document.getElementById('app');
  stage.classList.add('stage');
  const view = createHighlightView(stage, { world, teams: { home, away } });
  window.__hl = {
    ready: true,
    world: () => world,
    input: (cmd) => view.input(cmd),
    cameraTarget: view.cameraTarget,
    figureCount: view.figureCount,
    frames: view.frames,
  };
}

if (params.get('dev') === 'highlight') {
  devHighlight();
} else {
  render(html`<${App} />`, document.getElementById('app'));
}

window.__app = { ready: true, libs: { three: REVISION, preact: typeof h === 'function' } };
