// Anima um boneco a partir do estado do motor: parado, trote, corrida,
// comemoração (clipes) e chute (osso da perna por código, por cima do clipe).
import { PropertyBinding } from 'three';

// O carregador de glTF limpa os nomes ('DEF-thigh.R' vira 'DEF-thighR').
const bone = (player, name) => player.bones[PropertyBinding.sanitizeNodeName(name)];
const FADE = 0.2;              // s de transição entre clipes
const JOG_FROM = 0.6;          // m/s
const SPRINT_FROM = 5.2;       // m/s
const JOG_REF = 3.6;           // m/s em que o clipe de trote casa com o passo
const SPRINT_REF = 7.5;
const KICK_TIME = 0.45;        // s do movimento de chute (preparação + golpe)
const KICK_SPLIT = 0.3;        // fração do tempo na preparação
const BACKSWING = 0.7;         // rad: coxa para trás na preparação
const SWING = -1.4;            // rad: coxa para frente no golpe
const KNEE_BEND = 1.3;         // rad: joelho dobrado na preparação
const DIVE_RISE = 4;           // por segundo: rapidez com que o goleiro se estica

export function createAnimator(player) {
  let current = null;
  let kick = 0;
  let dive = 0;
  const thigh = bone(player, 'DEF-thigh.R');
  const shin = bone(player, 'DEF-shin.R');

  function play(name, timeScale = 1) {
    const next = player.actions[name];
    if (!next) return;
    next.timeScale = timeScale;
    if (current === name) return;
    next.reset().fadeIn(FADE).play();
    if (current) player.actions[current].fadeOut(FADE);
    current = name;
  }

  return {
    get clip() { return current; },
    // 0 se a perna não existe: o chute só conta quando o osso de fato gira.
    get kick() { return thigh && shin ? kick : 0; },
    get dive() { return dive; },
    update(agent, world, dt) {
      const speed = Math.hypot(agent.vel.x, agent.vel.y);
      const scorer = world.status === 'goal' && world.lastKick?.from === agent.id;
      const diving = agent.role === 'GK' && world.dive?.by === agent.id && world.dive.dir !== 0;
      dive = diving ? Math.min(1, dive + DIVE_RISE * dt) : Math.max(0, dive - DIVE_RISE * dt);
      if (scorer) play('Dance_Loop');
      else if (diving) play('Jump_Loop');
      else if (world.awaitingInput || speed < JOG_FROM) play('Idle_Loop');
      else if (speed < SPRINT_FROM) play('Jog_Fwd_Loop', speed / JOG_REF);
      else play('Sprint_Loop', speed / SPRINT_REF);
      player.mixer.update(dt);

      // Chute: coxa para trás com joelho dobrado, depois golpe com a perna esticada.
      const since = world.lastKick?.from === agent.id ? world.t - world.lastKick.at : Infinity;
      const u = since >= 0 && since < KICK_TIME ? since / KICK_TIME : -1;
      kick = u >= 0 ? Math.sin(u * Math.PI) : 0;
      if (u >= 0 && thigh && shin) {
        const prep = Math.sin(Math.min(u / KICK_SPLIT, 1) * Math.PI / 2) * (u < KICK_SPLIT ? 1 : 0);
        const strike = u < KICK_SPLIT ? 0 : Math.sin(((u - KICK_SPLIT) / (1 - KICK_SPLIT)) * Math.PI);
        thigh.rotation.x += BACKSWING * prep + SWING * strike;
        shin.rotation.x += KNEE_BEND * prep * (1 - strike);
      }
    },
  };
}
