// Bola de desenho próprio (faixas curvas azul e dourado sobre branco) que
// rola de verdade: gira em torno do eixo perpendicular ao movimento.
import * as THREE from 'three';

export const BALL_RADIUS = 0.11 * 2; // um pouco maior que a real, para ler na câmera alta

function ballTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f7f7f4';
  g.fillRect(0, 0, 512, 256);
  const band = (color, phase, width) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    for (let x = 0; x <= 512; x += 4) {
      const y = 128 + Math.sin((x / 512) * Math.PI * 4 + phase) * 70;
      if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  };
  band('#1b3a8f', 0, 26);
  band('#f2b33d', Math.PI, 14);
  band('#1b3a8f', Math.PI / 2, 8);
  // Costuras.
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 2;
  for (let x = 0; x < 512; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createBall() {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 32, 20),
    new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.35, metalness: 0 }),
  );
  mesh.castShadow = true;
  mesh.name = 'ball';
  const axis = new THREE.Vector3(), q = new THREE.Quaternion();
  return {
    mesh,
    info: { textured: true, spins: true },
    // Motor (x, y, z) → Three (x, z, y).
    update(ball, dt) {
      mesh.position.set(ball.pos.x, ball.pos.z + BALL_RADIUS, ball.pos.y);
      const speed = Math.hypot(ball.vel.x, ball.vel.y);
      if (speed > 0.05) {
        axis.set(ball.vel.y, 0, -ball.vel.x).normalize();
        q.setFromAxisAngle(axis, (speed * dt) / BALL_RADIUS);
        mesh.quaternion.premultiply(q);
      }
      if (ball.spin) mesh.rotateY(ball.spin * dt * 0.5);
    },
  };
}
