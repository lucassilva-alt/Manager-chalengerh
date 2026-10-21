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

// Estado do replay no instante t, interpolado entre os dois quadros vizinhos.
export function frameAt(frames, t) {
  if (!frames.length) return null;
  let i = frames.findIndex((f) => f.t > t);
  if (i === -1) i = frames.length - 1;
  const b = frames[Math.max(1, i)] ?? frames[0], a = frames[Math.max(0, i - 1)];
  const span = b.t - a.t || 1;
  const k = Math.min(1, Math.max(0, (t - a.t) / span));
  const lerp = (p, q) => p + (q - p) * k;
  const prev = new Map(a.agents.map((x) => [x.id, x]));
  return {
    t: Math.min(Math.max(t, frames[0].t), frames.at(-1).t),
    ball: { x: lerp(a.ball.x, b.ball.x), y: lerp(a.ball.y, b.ball.y), z: lerp(a.ball.z, b.ball.z) },
    ballVel: { x: (b.ball.x - a.ball.x) / span, y: (b.ball.y - a.ball.y) / span, z: (b.ball.z - a.ball.z) / span },
    agents: b.agents.map((q) => {
      const p = prev.get(q.id) ?? q;
      return { id: q.id, pos: { x: lerp(p.x, q.x), y: lerp(p.y, q.y) }, vel: { x: (q.x - p.x) / span, y: (q.y - p.y) / span } };
    }),
  };
}
