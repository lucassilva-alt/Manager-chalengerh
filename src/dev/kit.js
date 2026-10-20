// ?dev=kit — vitrine do uniforme: jogador de frente, de costas e goleiro,
// em pose de repouso, com leitura de pixels para os testes.
import * as THREE from 'three';
import { loadPlayerAsset, createPlayer } from '../render/player-model.js';

const KIT = { shirt: '#d33a2d', shorts: '#1d2b6b', socks: '#2a9d4b', accent: '#ffffff' };

export async function devKit(container) {
  const asset = await loadPlayerAsset();
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(container.clientWidth || innerWidth, container.clientHeight || innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#202428');
  scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(0, 3, 6);
  scene.add(sun);

  const players = {
    front: { x: -1.6, rotY: 0, opts: { kit: KIT, number: 10, id: 'front' } },
    back: { x: 0, rotY: Math.PI, opts: { kit: KIT, number: 10, id: 'back' } },
    keeper: { x: 1.6, rotY: 0, opts: { kit: KIT, number: 1, keeper: true, id: 'keeper' } },
  };
  for (const p of Object.values(players)) {
    const pl = createPlayer(asset, p.opts);
    pl.root.position.x = p.x;
    pl.root.rotation.y = p.rotY;
    scene.add(pl.root);
    p.root = pl.root;
  }
  const aspect = renderer.domElement.width / renderer.domElement.height;
  const camera = new THREE.OrthographicCamera(-2.6 * aspect, 2.6 * aspect, 1.3, -1.3, 0.1, 20) // bordas relativas à câmera (y = 0,9);
  camera.position.set(0, 0.9, 8);
  camera.lookAt(0, 0.9, 0);
  scene.updateMatrixWorld(true);
  renderer.render(scene, camera);

  const gl = renderer.getContext();
  const readPixel = (sx, sy) => {
    const px = new Uint8Array(4);
    gl.readPixels(Math.round(sx), Math.round(renderer.domElement.height - sy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    return [px[0], px[1], px[2]];
  };
  // Ponto do corpo (em metros, na pose de repouso) → pixel na tela.
  const toScreen = (id, p) => {
    const v = players[id].root.localToWorld(new THREE.Vector3(p.x, p.y, p.z)).project(camera);
    return { x: ((v.x + 1) / 2) * renderer.domElement.width, y: ((1 - v.y) / 2) * renderer.domElement.height };
  };
  window.__kit = {
    ready: true,
    colorAt: (id, p) => { const s = toScreen(id, p); return readPixel(s.x, s.y); },
    // Conta pixels quase brancos na área do número (costas, de 1,12 a 1,40 m).
    numberPixels: (id) => {
      let white = 0;
      for (let y = 1.14; y < 1.39; y += 0.01) {
        for (let x = -0.12; x <= 0.12; x += 0.01) {
          const z = id === 'back' ? -0.12 : 0.14;
          const [r, g, b] = (() => { const s = toScreen(id, { x, y, z }); return readPixel(s.x, s.y); })();
          if (r > 200 && g > 200 && b > 200) white++;
        }
      }
      return { white };
    },
  };
}
