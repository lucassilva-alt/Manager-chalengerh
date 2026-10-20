import { REVISION } from 'three';
import { h, render } from 'preact';
import htm from 'htm';
import { App } from './ui/app.js';

const html = htm.bind(h);
const params = new URLSearchParams(location.search);
const seedParam = Number(params.get('seed')) || undefined;

// Ganchos para testes de navegador e depuração (não mudam o jogo).
function exposeHighlight(view) {
  window.__hl = {
    ready: true,
    world: view.world,
    input: (cmd) => view.input(cmd),
    mode: view.mode,
    overlay: view.overlay,
    screenOf: view.screenOf,
    screenOfPoint: view.screenOfPoint,
    cameraTarget: view.cameraTarget,
    figureCount: view.figureCount,
    frames: view.frames,
    stats: view.stats,
  };
}

async function devHighlight() {
  const [{ loadDemoTeams }, sim, { startHighlight }, { HighlightStage }] = await Promise.all([
    import('./data/demo.js'),
    import('./engine/match-sim.js'),
    import('./engine/highlight/scenario.js'),
    import('./ui/highlight-stage.js'),
  ]);
  const [home, away] = await loadDemoTeams();
  const seed = seedParam || 1;
  const m = sim.createMatch({ home, away, seed, userSide: 'home', interactive: true });
  while (!m.pending && m.phase !== 'ended') {
    if (m.phase === 'halftime') sim.startSecondHalf(m); else sim.advanceMinute(m);
  }
  const world = startHighlight(m, { seed });
  render(html`<${HighlightStage} world=${world} teams=${{ home, away }} onView=${exposeHighlight} />`, document.getElementById('app'));
}

if (params.get('dev') === 'highlight') {
  devHighlight();
} else if (params.get('dev') === 'kit') {
  const stage = document.getElementById('app');
  stage.classList.add('stage');
  import('./dev/kit.js').then(({ devKit }) => devKit(stage));
} else {
  render(html`<${App} seed=${seedParam} onHighlightView=${exposeHighlight} />`, document.getElementById('app'));
}

window.__app = { ready: true, libs: { three: REVISION, preact: typeof h === 'function' } };
