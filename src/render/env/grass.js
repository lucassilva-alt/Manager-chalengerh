// Gramado: faixas de corte, variação de cor, desgaste na boca do gol e nas
// áreas, linhas nítidas e relevo fino de grama (normal map repetido).
import * as THREE from 'three';
import { FIELD } from '../../engine/highlight/field.js';

const MARGIN = 7;           // m de grama além das linhas
const TEX_WIDTH = 4096;     // px ao longo do campo
const LINE = 0.12;          // m de largura das linhas
const STRIPES = 18;

// Ruído barato e determinístico (sem Math.random: mesma grama sempre).
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function colorMap() {
  const L = FIELD.halfLength * 2 + MARGIN * 2, W = FIELD.halfWidth * 2 + MARGIN * 2;
  const px = TEX_WIDTH / L;
  const c = document.createElement('canvas');
  c.width = TEX_WIDTH; c.height = Math.round(W * px);
  const g = c.getContext('2d');
  const X = (x) => (x + FIELD.halfLength + MARGIN) * px, Y = (y) => (y + FIELD.halfWidth + MARGIN) * px;

  // Faixas de corte (claro/escuro alternando ao longo do campo).
  for (let i = 0; i < STRIPES; i++) {
    g.fillStyle = i % 2 ? '#4f8a2c' : '#5c9a33';
    g.fillRect(X(-FIELD.halfLength) + (i * (FIELD.halfLength * 2 * px)) / STRIPES, 0, (FIELD.halfLength * 2 * px) / STRIPES + 1, c.height);
  }
  // Fora das linhas: grama um pouco mais escura.
  g.fillStyle = 'rgba(30, 60, 20, 0.28)';
  g.fillRect(0, 0, X(-FIELD.halfLength), c.height);
  g.fillRect(X(FIELD.halfLength), 0, c.width, c.height);
  g.fillRect(0, 0, c.width, Y(-FIELD.halfWidth));
  g.fillRect(0, Y(FIELD.halfWidth), c.width, c.height);

  // Manchas suaves de cor (grama nunca é uniforme).
  for (let i = 0; i < 1400; i++) {
    const x = hash(i, 1) * c.width, y = hash(i, 2) * c.height, r = 20 + hash(i, 3) * 90;
    const light = hash(i, 4) > 0.5;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, light ? 'rgba(150, 190, 80, 0.10)' : 'rgba(25, 55, 15, 0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Desgaste: boca do gol e marca do pênalti.
  for (const s of [-1, 1]) {
    for (const [cx, cy, r, a] of [[s * (FIELD.halfLength - 2.5), 0, 5, 0.35], [s * (FIELD.halfLength - 11), 0, 2.2, 0.25]]) {
      const grad = g.createRadialGradient(X(cx), Y(cy), 0, X(cx), Y(cy), r * px);
      grad.addColorStop(0, `rgba(120, 105, 60, ${a})`);
      grad.addColorStop(1, 'rgba(120, 105, 60, 0)');
      g.fillStyle = grad;
      g.fillRect(X(cx) - r * px, Y(cy) - r * px, r * 2 * px, r * 2 * px);
    }
  }

  // Linhas.
  const m = (v) => v * px;
  g.strokeStyle = 'rgba(245, 248, 240, 0.95)';
  g.fillStyle = 'rgba(245, 248, 240, 0.95)';
  g.lineWidth = m(LINE);
  g.strokeRect(X(-FIELD.halfLength), Y(-FIELD.halfWidth), m(FIELD.halfLength * 2), m(FIELD.halfWidth * 2));
  g.beginPath(); g.moveTo(X(0), Y(-FIELD.halfWidth)); g.lineTo(X(0), Y(FIELD.halfWidth)); g.stroke();
  g.beginPath(); g.arc(X(0), Y(0), m(9.15), 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(X(0), Y(0), m(0.18), 0, Math.PI * 2); g.fill();
  for (const s of [-1, 1]) {
    const line = s * FIELD.halfLength;
    g.strokeRect(Math.min(X(line), X(line - s * 16.5)), Y(-20.16), m(16.5), m(40.32));
    g.strokeRect(Math.min(X(line), X(line - s * 5.5)), Y(-9.16), m(5.5), m(18.32));
    g.beginPath(); g.arc(X(line - s * 11), Y(0), m(0.15), 0, Math.PI * 2); g.fill();
    // Meia-lua da área.
    const start = s > 0 ? Math.PI - 0.927 : -0.927, end = s > 0 ? Math.PI + 0.927 : 0.927;
    g.beginPath(); g.arc(X(line - s * 11), Y(0), m(9.15), start, end); g.stroke();
    // Arcos de escanteio.
    for (const t of [-1, 1]) {
      g.beginPath(); g.arc(X(line), Y(t * FIELD.halfWidth), m(1), 0, Math.PI * 2); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, L, W, size: c.width };
}

// Relevo de grama: altura em ruído fino → normal map pequeno e repetido.
function grassNormalMap() {
  const N = 256, c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d'), img = g.createImageData(N, N);
  const h = (x, y) => hash(((x % N) + N) % N, ((y % N) + N) % N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * 1.6, dy = (h(x, y + 1) - h(x, y - 1)) * 1.6;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * N + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(60, 40);
  return tex;
}

export function createGrass() {
  const { tex, L, W, size } = colorMap();
  const normalMap = grassNormalMap();
  const mat = new THREE.MeshStandardMaterial({ map: tex, normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.92, metalness: 0 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(L, W), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.name = 'grass';
  mesh.userData.info = { size, normalMap: true };
  return mesh;
}

export const PITCH_MARGIN = MARGIN;
