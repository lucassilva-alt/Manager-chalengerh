// Barreira da falta: jogadores lado a lado na linha bola → canto mais perto.
const WALL_GAP = 9.15;

export function placeWall(w, size) {
  const ball = w.ball.pos, goalX = 52.5 * w.attackDir;
  const nearPost = { x: goalX, y: Math.sign(ball.y || 1) * 1.6 };
  const len = Math.hypot(nearPost.x - ball.x, nearPost.y - ball.y);
  const dir = { x: (nearPost.x - ball.x) / len, y: (nearPost.y - ball.y) / len };
  const perp = { x: -dir.y, y: dir.x };
  const center = { x: ball.x + dir.x * WALL_GAP, y: ball.y + dir.y * WALL_GAP };
  const SPACING = 0.55;
  for (const a of w.agents) a.inWall = false;
  const defenders = w.agents.filter((a) => a.side !== w.attackingSide && a.role !== 'GK').slice(0, size);
  defenders.forEach((a, i) => {
    const off = (i - (size - 1) / 2) * SPACING;
    a.pos = { x: center.x + perp.x * off, y: center.y + perp.y * off };
    a.home = { ...a.pos };
    a.inWall = true;
  });
  // Altura de quem pula na barreira: ~1,8 m + 0,3 m de pulo.
  w.wall = { center, dir, perp, size, halfWidth: (size * SPACING) / 2, height: 1.8, jump: 0.3 };
}

