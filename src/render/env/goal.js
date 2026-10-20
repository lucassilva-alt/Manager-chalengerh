// Gol com traves redondas, suportes, rede em malha que balança no gol e
// bandeirinhas de escanteio que tremulam.
import * as THREE from 'three';
import { FIELD } from '../../engine/highlight/field.js';

const POST_R = 0.06;
const DEPTH = 2.0;        // m da rede para trás da linha
const MESH = 0.14;        // m entre fios da rede

const white = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.35, metalness: 0.1 });

// Rede: grade de fios (linhas) nos planos do fundo, topo e laterais, com leve barriga.
function net() {
  const gw = FIELD.goalHalfWidth, gh = FIELD.goalHeight;
  const pts = [];
  // Ponto da rede em coordenadas (u ao longo da largura, v da altura) do fundo e laterais.
  const back = (u, v) => [DEPTH, v, u];
  const sag = (x, y, z) => [x + Math.sin((y / gh) * Math.PI) * 0.15, y, z];
  const add = (a, b) => pts.push(...sag(...a), ...sag(...b));
  for (let z = -gw; z <= gw + 1e-6; z += MESH) add(back(z, 0), back(z, gh));
  for (let y = 0; y <= gh + 1e-6; y += MESH) add(back(-gw, y), back(gw, y));
  for (const s of [-1, 1]) {
    for (let x = 0; x <= DEPTH + 1e-6; x += MESH) add([x, 0, s * gw], [x, gh, s * gw]);
    for (let y = 0; y <= gh + 1e-6; y += MESH) add([0, y, s * gw], [DEPTH, y, s * gw]);
  }
  for (let z = -gw; z <= gw + 1e-6; z += MESH) add([0, gh, z], [DEPTH, gh, z]);
  for (let x = 0; x <= DEPTH + 1e-6; x += MESH) add([x, gh, -gw], [x, gh, gw]);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  geo.userData.rest = Float32Array.from(pts);
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#f0f0f0', transparent: true, opacity: 0.55 }));
  lines.name = 'net';
  return lines;
}

function goal(side) {
  const g = new THREE.Group();
  g.name = 'goal';
  const gw = FIELD.goalHalfWidth, gh = FIELD.goalHeight;
  const postGeo = new THREE.CylinderGeometry(POST_R, POST_R, gh, 16);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(postGeo, white);
    p.position.set(0, gh / 2, s * gw);
    p.castShadow = true;
    p.userData.round = true;
    g.add(p);
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(POST_R, POST_R, gw * 2, 16), white);
  bar.rotation.x = Math.PI / 2;
  bar.position.y = gh;
  bar.castShadow = true;
  g.add(bar);
  // Suportes de trás (finos, escuros).
  const support = new THREE.MeshStandardMaterial({ color: '#8b9096', roughness: 0.5, metalness: 0.6 });
  for (const s of [-1, 1]) {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, Math.hypot(DEPTH, gh), 8), support);
    rod.position.set(DEPTH / 2, gh / 2, s * gw);
    rod.rotation.z = Math.atan2(DEPTH, gh);
    g.add(rod);
  }
  const n = net();
  g.add(n);
  g.position.x = side * FIELD.halfLength;
  g.scale.x = side; // rede para fora do campo nos dois lados
  return { group: g, net: n };
}

function cornerFlag(x, z, color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8), new THREE.MeshStandardMaterial({ color: '#f2f2f2' }));
  pole.position.y = 0.75;
  pole.castShadow = true;
  const flagGeo = new THREE.PlaneGeometry(0.42, 0.3, 6, 1);
  flagGeo.translate(0.21, 0, 0);
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8 }));
  flag.position.y = 1.35;
  flag.userData.rest = Float32Array.from(flagGeo.attributes.position.array);
  g.add(pole, flag);
  g.position.set(x, 0, z);
  g.name = 'cornerFlag';
  return { group: g, flag };
}

export function createGoals() {
  const group = new THREE.Group();
  const goals = [goal(1), goal(-1)];
  const flags = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) flags.push(cornerFlag(sx * FIELD.halfLength, sz * FIELD.halfWidth, '#f2b33d'));
  for (const g of goals) group.add(g.group);
  for (const f of flags) group.add(f.group);
  let shake = 0, shakeSide = 1;

  return {
    group,
    info: { goals: goals.length, roundPosts: true, nets: goals.length, cornerFlags: flags.length },
    // A rede estufa quando a bola entra.
    netHit(side) { shake = 1; shakeSide = side; },
    update(t, dt) {
      for (const { flag } of flags) {
        const pos = flag.geometry.attributes.position, rest = flag.userData.rest;
        for (let i = 0; i < pos.count; i++) {
          const x = rest[i * 3];
          pos.setZ(i, Math.sin(t * 6 + x * 9) * 0.05 * x * 3);
        }
        pos.needsUpdate = true;
      }
      if (shake <= 0) return;
      shake = Math.max(0, shake - dt * 0.8);
      const n = goals[shakeSide > 0 ? 0 : 1].net;
      const pos = n.geometry.attributes.position, rest = n.geometry.userData.rest;
      for (let i = 0; i < pos.count; i++) {
        const y = rest[i * 3 + 1], z = rest[i * 3 + 2];
        const wave = Math.sin(t * 18 - Math.abs(z) * 1.5) * shake * 0.35 * Math.sin((y / FIELD.goalHeight) * Math.PI);
        pos.setX(i, rest[i * 3] + Math.max(0, wave + shake * 0.4) * (rest[i * 3] / DEPTH));
      }
      pos.needsUpdate = true;
    },
  };
}
