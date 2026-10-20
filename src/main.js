import { REVISION } from 'three';
import { h, render } from 'preact';
import htm from 'htm';

const html = htm.bind(h);
const params = new URLSearchParams(location.search);

function App() {
  return html`<main><h1>Manager Challenger</h1></main>`;
}

async function devHighlight() {
  const [{ loadDemoTeams }, sim, { startHighlight }, { HighlightStage }] = await Promise.all([
    import('./data/demo.js'),
    import('./engine/match-sim.js'),
    import('./engine/highlight/scenario.js'),
    import('./ui/highlight-stage.js'),
  ]);
  const [home, away] = await loadDemoTeams();
  const seed = Number(params.get('seed')) || 1;
  const m = sim.createMatch({ home, away, seed, userSide: 'home', interactive: true });
  while (!m.pending && m.phase !== 'ended') {
    if (m.phase === 'halftime') sim.startSecondHalf(m); else sim.advanceMinute(m);
  }
  const world = startHighlight(m, { seed });
  const onView = (view) => {
    window.__hl = {
      ready: true,
      world: () => world,
      input: (cmd) => view.input(cmd),
      mode: view.mode,
      overlay: view.overlay,
      screenOf: view.screenOf,
      screenOfPoint: view.screenOfPoint,
      cameraTarget: view.cameraTarget,
      figureCount: view.figureCount,
      frames: view.frames,
    };
  };
  render(html`<${HighlightStage} world=${world} teams=${{ home, away }} onView=${onView} />`, document.getElementById('app'));
}

if (params.get('dev') === 'highlight') {
  devHighlight();
} else {
  render(html`<${App} />`, document.getElementById('app'));
}

window.__app = { ready: true, libs: { three: REVISION, preact: typeof h === 'function' } };
