// Gravador do replay: guarda os últimos segundos do lance em quadros leves.
import { DT } from './physics.js';

export function createRecorder({ seconds = 6 } = {}) {
  const capacity = Math.round(seconds / DT);
  const buffer = [];
  return {
    record(w) {
      if (buffer.length && buffer.at(-1).t === w.t) return; // mesmo instante
      buffer.push({
        t: w.t,
        ball: { x: w.ball.pos.x, y: w.ball.pos.y, z: w.ball.pos.z },
        agents: w.agents.map((a) => ({ id: a.id, x: a.pos.x, y: a.pos.y })),
      });
      if (buffer.length > capacity) buffer.shift();
    },
    frames: () => buffer.slice(),
    summary: (w) => ({
      scorerId: w.lastKick?.type === 'shot' ? w.lastKick.from : null,
      distance: w.lastKick?.type === 'shot' ? Number(w.lastKick.distance.toFixed(1)) : null,
    }),
  };
}
