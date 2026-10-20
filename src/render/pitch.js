// Gramado com faixas e linhas desenhadas numa textura, gols e arquibancadas simples.
import * as THREE from 'three';
import { FIELD } from '../engine/highlight/field.js';

const MARGIN = 6;
const PX_PER_M = 10;

function pitchTexture() {
  const L = FIELD.halfLength * 2 + MARGIN * 2, W = FIELD.halfWidth * 2 + MARGIN * 2;
  const c = document.createElement('canvas');
  c.width = L * PX_PER_M; c.height = W * PX_PER_M;
  const g = c.getContext('2d');
  const stripes = 14;
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = i % 2 ? '#8aa93f' : '#93b245';
    g.fillRect((i * c.width) / stripes, 0, c.width / stripes + 1, c.height);
  }
  const m = (v) => v * PX_PER_M;
  const X = (x) => m(x + FIELD.halfLength + MARGIN), Y = (y) => m(y + FIELD.halfWidth + MARGIN);
  g.strokeStyle = 'rgba(255,255,255,0.92)';
  g.lineWidth = 2.2;
  g.strokeRect(X(-FIELD.halfLength), Y(-FIELD.halfWidth), m(FIELD.halfLength * 2), m(FIELD.halfWidth * 2));
  g.beginPath(); g.moveTo(X(0), Y(-FIELD.halfWidth)); g.lineTo(X(0), Y(FIELD.halfWidth)); g.stroke();
  g.beginPath(); g.arc(X(0), Y(0), m(9.15), 0, Math.PI * 2); g.stroke();
  for (const s of [-1, 1]) {
    const line = s * FIELD.halfLength;
    g.strokeRect(Math.min(X(line), X(line - s * 16.5)), Y(-20.16), m(16.5), m(40.32));
    g.strokeRect(Math.min(X(line), X(line - s * 5.5)), Y(-9.16), m(5.5), m(18.32));
    g.beginPath(); g.arc(X(line - s * 11), Y(0), 2, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, L, W };
}

function goal(side) {
  const g = new THREE.Group();
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const post = new THREE.BoxGeometry(0.12, FIELD.goalHeight, 0.12);
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(post, white);
    p.position.set(0, FIELD.goalHeight / 2, s * FIELD.goalHalfWidth);
    g.add(p);
  }
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, FIELD.goalHalfWidth * 2 + 0.12), white);
  bar.position.y = FIELD.goalHeight;
  g.add(bar);
  const net = new THREE.Mesh(
    new THREE.BoxGeometry(2, FIELD.goalHeight, FIELD.goalHalfWidth * 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 }),
  );
  net.position.set(side, FIELD.goalHeight / 2, 0);
  g.add(net);
  g.position.x = side * FIELD.halfLength;
  return g;
}

function stands(L, W) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x8a8f99 });
  const crowd = new THREE.MeshLambertMaterial({ color: 0xb53b3b });
  for (const s of [-1, 1]) {
    const base = new THREE.Mesh(new THREE.BoxGeometry(L, 6, 10), mat);
    base.position.set(0, 3, s * (W / 2 + 6));
    const people = new THREE.Mesh(new THREE.BoxGeometry(L - 4, 1.2, 8), crowd);
    people.position.set(0, 6.6, s * (W / 2 + 6));
    g.add(base, people);
  }
  return g;
}

export function createPitch() {
  const { tex, L, W } = pitchTexture();
  const g = new THREE.Group();
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(L, W), new THREE.MeshLambertMaterial({ map: tex }));
  grass.rotation.x = -Math.PI / 2;
  g.add(grass, goal(1), goal(-1), stands(L, W));
  return g;
}
