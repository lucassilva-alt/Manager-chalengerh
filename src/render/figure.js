// Boneco montado por código: tronco, shorts, pernas, braços e cabeça.
// Geometrias compartilhadas; materiais por uniforme. Altura ~1,8 m.
import * as THREE from 'three';

const geo = {
  torso: new THREE.BoxGeometry(0.42, 0.55, 0.26),
  shorts: new THREE.BoxGeometry(0.42, 0.22, 0.27),
  leg: new THREE.BoxGeometry(0.15, 0.78, 0.16),
  arm: new THREE.BoxGeometry(0.11, 0.55, 0.12),
  head: new THREE.SphereGeometry(0.15, 10, 8),
  shadow: new THREE.CircleGeometry(0.45, 16),
};
const SKINS = ['#f1c7a3', '#d9a066', '#a8693f', '#6b4226'];
const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
const matCache = new Map();
const mat = (color) => {
  if (!matCache.has(color)) matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return matCache.get(color);
};

function limb(geometry, material, pivotY) {
  // Pivô no topo para balançar a partir do quadril/ombro.
  const pivot = new THREE.Group();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = -geometry.parameters.height / 2;
  pivot.add(mesh);
  pivot.position.y = pivotY;
  return pivot;
}

export function createFigure({ shirt, shorts, socks, keeper = false, skinIndex = 0 }) {
  const shirtMat = mat(keeper ? '#e8d23a' : shirt);
  const skin = mat(SKINS[skinIndex % SKINS.length]);
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);

  const legL = limb(geo.leg, mat(socks), 0.8); legL.position.x = -0.11;
  const legR = limb(geo.leg, mat(socks), 0.8); legR.position.x = 0.11;
  const hips = new THREE.Mesh(geo.shorts, mat(shorts)); hips.position.y = 0.86;
  const torso = new THREE.Mesh(geo.torso, shirtMat); torso.position.y = 1.24;
  const armL = limb(geo.arm, shirtMat, 1.48); armL.position.x = -0.28;
  const armR = limb(geo.arm, shirtMat, 1.48); armR.position.x = 0.28;
  const head = new THREE.Mesh(geo.head, skin); head.position.y = 1.68;
  body.add(legL, legR, hips, torso, armL, armR, head);

  const shadow = new THREE.Mesh(geo.shadow, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  g.add(shadow);

  g.userData = { legL, legR, armL, armR, body, phase: 0, kickT: -1 };
  return g;
}

// Corrida: balanço das pernas e braços pela velocidade; chute: perna direita à frente.
export function animateFigure(fig, { vx, vy, dt, kicking }) {
  const u = fig.userData;
  const speed = Math.hypot(vx, vy);
  if (speed > 0.3) fig.rotation.y = Math.atan2(vx, vy);
  u.phase += dt * (4 + speed * 1.6);
  const swing = Math.min(1, speed / 7) * 0.9;
  const s = Math.sin(u.phase) * swing;
  u.legL.rotation.x = s;
  u.legR.rotation.x = kicking ? -1.2 : -s;
  u.armL.rotation.x = -s * 0.8;
  u.armR.rotation.x = s * 0.8;
  u.body.position.y = Math.abs(Math.cos(u.phase)) * 0.05 * swing;
}
