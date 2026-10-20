// Boneco animado: carrega o glTF uma vez, clona por jogador e aplica o uniforme.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { createKitMaterial } from './kit-material.js';

const URL = 'assets/models/player.glb';
let assetPromise = null;

export function loadPlayerAsset() {
  assetPromise ??= new GLTFLoader().loadAsync(URL);
  return assetPromise;
}

const SKINS = ['#f3cfb3', '#e0ac85', '#c68a5e', '#9a643e', '#6e4529', '#4c2f1d'];
const HAIRS = ['#1d1612', '#3b2618', '#6b4423', '#a8743f', '#d9b36b', '#2a2a2a'];

// Tom de pele e cabelo estáveis por jogador (mesmo id = mesma aparência).
export function looksFor(id) {
  let h = 2166136261;
  for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h >>>= 0;
  return { skin: SKINS[h % SKINS.length], hair: HAIRS[(h >>> 8) % HAIRS.length] };
}

export function createPlayer(asset, { kit, number, keeper = false, id }) {
  const root = SkeletonUtils.clone(asset.scene);
  const material = createKitMaterial({ ...kit, ...looksFor(id), number, keeper, ...(keeper ? keeperKit(kit) : {}) });
  const bones = {};
  root.traverse((o) => {
    if (o.isMesh) {
      o.material = material;
      o.castShadow = true;
      o.frustumCulled = false; // a caixa do glTF é a da pose de repouso
    }
    if (o.isBone) bones[o.name] = o;
  });
  const mixer = new THREE.AnimationMixer(root);
  const actions = Object.fromEntries(asset.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
  return { root, mixer, actions, bones, material };
}

function keeperKit(kit) {
  return { shirt: kit.keeperShirt ?? '#f2c230', shorts: '#1b1b1f', socks: kit.keeperShirt ?? '#f2c230', accent: '#1b1b1f' };
}
