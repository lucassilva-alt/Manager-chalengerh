// App: pré-jogo → partida → resultado → nova partida.
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import htm from 'htm';
import { loadDemoTeams } from '../data/demo.js';
import { createMatchFlow } from './match-flow.js';
import { PreMatch } from './pre-match.js';
import { MatchScreen } from './match-screen.js';
import { ResultScreen } from './result.js';
import { t } from '../i18n/index.js';

const html = htm.bind(h);

export function App({ seed: firstSeed = Date.now() % 100000, onHighlightView }) {
  const [teams, setTeams] = useState(null);
  const [screen, setScreen] = useState('pre');
  const [flow, setFlow] = useState(null);
  const [seed, setSeed] = useState(firstSeed);

  useEffect(() => { loadDemoTeams().then(setTeams); }, []);
  useEffect(() => { window.__flow = flow; }, [flow]);

  if (!teams) return html`<p class="loading" role="status">${t('common.loading')}</p>`;
  const [home, away] = teams;

  if (screen === 'pre') {
    return html`<${PreMatch} home=${home} away=${away} onPlay=${() => {
      const f = createMatchFlow({ home, away, seed, userSide: 'home' });
      f.play();
      setFlow(f);
      setScreen('match');
    }} />`;
  }
  if (screen === 'match') {
    return html`<${MatchScreen} flow=${flow} onEnd=${() => setScreen('result')} onHighlightView=${onHighlightView} />`;
  }
  return html`<${ResultScreen} match=${flow.match} onAgain=${() => { setSeed((s) => s + 1); setScreen('pre'); }} />`;
}
