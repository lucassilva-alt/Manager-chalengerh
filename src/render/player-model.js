// Boneco animado: carrega o glTF uma vez, clona por jogador e aplica o uniforme.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { createKitMaterial } from './kit-material.js';
import { looksFor } from '../data/looks.js';

const URL = 'assets/models/player.glb';
let assetPromise = null;

export function loadPlayerAsset() {
  assetPromise ??= new GLTFLoader().loadAsync(URL);
  return assetPromise;
}

export function createPlayer(asset, { kit, number, keeper = false, id }) {
  const root = SkeletonUtils.clone(asset.scene);
  const { skin, hair } = looksFor(id);
  const material = createKitMaterial({ ...kit, skin, hair, number, keeper, ...(keeper ? keeperKit(kit) : {}) });
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
