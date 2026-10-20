// Fluxo da partida na tela (sem DOM): relógio, velocidade, pausa, lances,
// voltar o lance, intervalo e simular. A interface só lê o estado e chama ações.
import * as sim from '../engine/match-sim.js';
import { startHighlight, rewindHighlight, finishHighlight, outcomeOf } from '../engine/highlight/scenario.js';

export const MINUTE_SECONDS = 0.6; // 1 minuto de jogo a cada 0,6 s na velocidade normal

export function createMatchFlow({ home, away, seed, userSide = 'home', interactive = true }) {
  const match = sim.createMatch({ home, away, seed, userSide, interactive });
  const listeners = new Set();
  let acc = 0;

  const flow = {
    match,
    state: 'ready',      // ready | running | paused | highlight | highlightResult | halftime | ended
    speed: 1,
    world: null,
    lastOutcome: null,
    get canRewind() { return match.rewindsLeft > 0 && !!match.highlightStart; },

    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    play() { if (flow.state === 'ready' || flow.state === 'paused') set('running'); },
    pause() { if (flow.state === 'running') set('paused'); },
    setSpeed(s) { flow.speed = s; emit(); },

    tick(seconds) {
      if (flow.state !== 'running') return;
      acc += (seconds * flow.speed) / MINUTE_SECONDS;
      while (acc >= 1 && flow.state === 'running') {
        acc -= 1;
        sim.advanceMinute(match);
        settle();
      }
      emit();
    },

    endHighlight() {
      if (flow.state !== 'highlight') return;
      flow.lastOutcome = outcomeOf(flow.world);
      set('highlightResult');
    },
    continueAfterHighlight() {
      if (flow.state !== 'highlightResult') return;
      finishHighlight(match, flow.world);
      flow.world = null;
      set('running');
      settle();
    },
    rewind() {
      if (flow.state !== 'highlightResult' || !flow.canRewind) return;
      flow.world = rewindHighlight(match);
      set('highlight');
    },
    skipHighlight() {
      if (flow.state !== 'highlight') return;
      match.highlightStart = null;
      sim.simulateHighlight(match);
      flow.world = null;
      set('running');
      settle();
    },
    startSecondHalf() {
      if (flow.state !== 'halftime') return;
      sim.startSecondHalf(match);
      set('running');
    },
    simulateRest() {
      match.interactive = false;
      if (match.pending) { match.highlightStart = null; sim.simulateHighlight(match); }
      flow.world = null;
      while (match.phase !== 'ended') {
        if (match.phase === 'halftime') sim.startSecondHalf(match);
        else sim.advanceMinute(match);
      }
      set('ended');
    },
    clock() {
      if (flow.state === 'halftime' || flow.state === 'ended') return `${String(match.minute).padStart(2, '0')}:00`;
      const total = Math.floor((match.minute + Math.min(acc, 0.999)) * 60);
      return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    },
  };

  function set(state) { flow.state = state; emit(); }
  function emit() { for (const fn of listeners) fn(flow); }

  // Depois de cada minuto: lance pendente, intervalo ou fim mudam o estado.
  function settle() {
    if (match.pending && !flow.world) {
      acc = 0;
      flow.world = startHighlight(match, { seed: match.rng });
      flow.state = 'highlight';
    } else if (match.phase === 'halftime') {
      acc = 0;
      flow.state = 'halftime';
    } else if (match.phase === 'ended') {
      acc = 0;
      flow.state = 'ended';
    }
  }

  return flow;
}
