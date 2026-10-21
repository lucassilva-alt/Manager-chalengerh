// App: início → (carreira: escolher clube → central → jogo → entrevista) ou
// partida rápida com os times de demonstração.
import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import htm from 'htm';
import { loadDemoTeams } from '../data/demo.js';
import { loadCareerData } from '../data/career-data.js';
import { newCareer, nextFixture, completeRound, seasonOver, endSeason } from '../engine/career.js';
import { interviewFor, applyAnswer } from '../engine/interview.js';
import { createMatchFlow } from './match-flow.js';
import { PreMatch } from './pre-match.js';
import { MatchScreen } from './match-screen.js';
import { ResultScreen } from './result.js';
import { StartScreen } from './career/start.js';
import { ClubPicker } from './career/club-picker.js';
import { Hub } from './career/hub.js';
import { Interview } from './career/interview.js';
import { saveCareer, loadCareer } from './save.js';
import { t } from '../i18n/index.js';

const html = htm.bind(h);
const Loading = () => html`<p class="loading" role="status">${t('common.loading')}</p>`;

// Uma partida: pré-jogo → partida → resultado. `onDone(match)` ao sair do resultado.
function MatchSequence({ home, away, userSide, seed, onDone, onHighlightView, provisional = false, doneLabel }) {
  const [screen, setScreen] = useState('pre');
  const [flow, setFlow] = useState(null);
  useEffect(() => { window.__flow = flow; }, [flow]);
  if (screen === 'pre') {
    return html`<${PreMatch} home=${home} away=${away} provisional=${provisional} onPlay=${() => {
      const f = createMatchFlow({ home, away, seed, userSide });
      f.play();
      setFlow(f);
      setScreen('match');
    }} />`;
  }
  if (screen === 'match') return html`<${MatchScreen} flow=${flow} onEnd=${() => setScreen('result')} onHighlightView=${onHighlightView} />`;
  return html`<${ResultScreen} match=${flow.match} actionLabel=${doneLabel} onAgain=${() => onDone(flow.match)} />`;
}

function QuickMatch({ seed: firstSeed, onHighlightView }) {
  const [teams, setTeams] = useState(null);
  const [seed, setSeed] = useState(firstSeed);
  useEffect(() => { loadDemoTeams().then(setTeams); }, []);
  if (!teams) return html`<${Loading} />`;
  return html`<${MatchSequence} key=${seed} home=${teams[0]} away=${teams[1]} userSide="home" seed=${seed} provisional
    onHighlightView=${onHighlightView} onDone=${() => setSeed((s) => s + 1)} />`;
}

function Career({ initial, seed, onHighlightView, onExit }) {
  const [career, setCareer] = useState(initial);
  const [data, setData] = useState(null);
  const [screen, setScreen] = useState(initial ? 'hub' : 'picker');
  const [interview, setInterview] = useState(null);
  const [lastScore, setLastScore] = useState(null);
  useEffect(() => { if (!initial) loadCareerData().then(setData); }, []);
  const commit = (c) => { saveCareer(c); setCareer({ ...c }); };

  if (screen === 'picker') {
    if (!data) return html`<${Loading} />`;
    return html`<${ClubPicker} clubs=${data.clubs} onBack=${onExit} onPick=${(clubId) => {
      commit(newCareer({ ...data, clubId, seed }));
      setScreen('hub');
    }} />`;
  }
  if (screen === 'match') {
    const f = nextFixture(career);
    const userSide = f.home === career.clubId ? 'home' : 'away';
    return html`<${MatchSequence} home=${career.teams[f.home]} away=${career.teams[f.away]} userSide=${userSide}
      seed=${(career.seed + career.season * 100 + career.round) >>> 0} doneLabel=${t('common.continue')} onHighlightView=${onHighlightView}
      onDone=${(m) => {
        setLastScore({ ...m.score });
        const mine = m.score[userSide], theirs = m.score[userSide === 'home' ? 'away' : 'home'];
        setInterview(interviewFor({ goalsFor: mine, goalsAgainst: theirs }));
        setScreen('interview');
      }} />`;
  }
  if (screen === 'interview') {
    return html`<${Interview} interview=${interview} onAnswer=${(answer) => {
      const team = career.teams[career.clubId];
      const state = applyAnswer({ morale: Object.fromEntries(team.squad.map((p) => [p.id, p.morale])), fans: career.fans, board: career.board }, answer);
      for (const p of team.squad) p.morale = state.morale[p.id];
      career.fans = state.fans; career.board = state.board;
      completeRound(career, lastScore);
      commit(career);
      setScreen('hub');
    }} />`;
  }
  return html`<${Hub} career=${career} onPlay=${() => setScreen('match')}
    onNextSeason=${seasonOver(career) ? () => { endSeason(career); commit(career); } : null} />`;
}

export function App({ seed = Date.now() % 100000, onHighlightView }) {
  const quick = new URLSearchParams(location.search).get('quick') === '1';
  const [screen, setScreen] = useState(quick ? 'quick' : 'start');
  const [saved, setSaved] = useState(() => loadCareer());
  if (screen === 'quick') return html`<${QuickMatch} seed=${seed} onHighlightView=${onHighlightView} />`;
  if (screen === 'career') return html`<${Career} initial=${saved} seed=${seed} onHighlightView=${onHighlightView} onExit=${() => setScreen('start')} />`;
  return html`<${StartScreen} hasSave=${!!saved}
    onContinue=${() => setScreen('career')}
    onNew=${() => { setSaved(null); setScreen('career'); }}
    onQuick=${() => setScreen('quick')} />`;
}
